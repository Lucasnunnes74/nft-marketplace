import type { QueryClient } from '@tanstack/react-query'
import { io, type ManagerOptions, type Socket } from 'socket.io-client'
import {
  type Cart,
  type NftDetail,
  type NftList,
  type NftSummary,
  type NftUpdatedEvent,
  nftUpdatedEventSchema,
  type Order,
  orderUpdatedEventSchema,
  socketEvents,
} from '@/api/contracts'
import { qk } from '@/api/keys'
import { recordNftEvent, resetNftVersions } from '@/realtime/nft-versions'
import { formatEth } from '@/lib/eth'
import { pushNotice } from '@/stores/market-notices'
import { realtimeStatus } from '@/stores/realtime-status'
import { toast } from '@/stores/toasts'

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.nft.local'

function applyToSummary<T extends NftSummary>(item: T, evt: NftUpdatedEvent): T {
  if (item.id !== evt.id || evt.version <= item.version) return item
  return { ...item, price: evt.price, available: evt.available, version: evt.version }
}

export function applyNftUpdate(qc: QueryClient, evt: NftUpdatedEvent) {
  if (!recordNftEvent(evt)) return // duplicado ou mais antigo que o último aplicado

  // Avisos ao usuário se o NFT está no carrinho (antes de atualizar caches).
  const cart = qc.getQueriesData<Cart>({ queryKey: qk.cart })[0]?.[1]
  const inCart = cart?.items.find((i) => i.nftId === evt.id)
  if (inCart) {
    if (inCart.unitPrice !== evt.price) {
      pushNotice({
        nftId: evt.id,
        name: inCart.name,
        kind: 'price',
        from: formatEth(inCart.unitPrice),
        to: formatEth(evt.price),
      })
    }
    if (evt.available < inCart.available && evt.available < inCart.quantity) {
      pushNotice({
        nftId: evt.id,
        name: inCart.name,
        kind: 'stock',
        from: `${inCart.available} disp.`,
        to: evt.available === 0 ? 'esgotado' : `${evt.available} disp.`,
      })
    }
  }

  qc.setQueriesData<NftDetail>({ queryKey: ['nfts', 'detail'] }, (old) => (old ? applyToSummary(old, evt) : old))
  qc.setQueriesData<NftList>({ queryKey: ['nfts', 'list'] }, (old) =>
    old ? { ...old, items: old.items.map((i) => applyToSummary(i, evt)) } : old,
  )
  qc.setQueriesData<NftList>({ queryKey: qk.nfts.featured }, (old) =>
    old ? { ...old, items: old.items.map((i) => applyToSummary(i, evt)) } : old,
  )
  qc.setQueriesData<NftSummary[]>({ queryKey: qk.favorites }, (old) => old?.map((i) => applyToSummary(i, evt)))

  // Carrinho e cotação dependem de preço/estoque: refaz em segundo plano.
  void qc.invalidateQueries({ queryKey: qk.cart })
  void qc.invalidateQueries({ queryKey: ['quote'] })
}

export function applyOrderUpdate(qc: QueryClient, userId: string | null, raw: unknown) {
  const parsed = orderUpdatedEventSchema.safeParse(raw)
  if (!parsed.success) return
  const evt = parsed.data
  // Eventos de outro usuário/sessão anterior nunca devem atualizar este cliente.
  if (!userId || evt.userId !== userId) return

  const current = qc.getQueryData<Order>(qk.order(evt.orderId))
  if (current && evt.version <= current.version) return // duplicado ou antigo
  if (current) {
    qc.setQueryData<Order>(qk.order(evt.orderId), {
      ...current,
      status: evt.status,
      version: evt.version,
      updatedAt: evt.updatedAt,
      txHash: evt.txHash ?? current.txHash,
      failureReason: evt.failureReason ?? current.failureReason,
    })
  }
  // Refetch para obter recibo completo (hash, explorer simulado) e o carrinho já ajustado.
  void qc.invalidateQueries({ queryKey: qk.order(evt.orderId) })
  void qc.invalidateQueries({ queryKey: qk.cart })
  void qc.invalidateQueries({ queryKey: ['quote'] })

  if (evt.status === 'confirmed') toast({ title: 'Pedido confirmado', description: 'Sua compra foi concluída.', variant: 'success' })
  if (evt.status === 'rejected') toast({ title: 'Pagamento recusado', description: evt.failureReason ?? undefined, variant: 'destructive' })
}

/**
 * Conecta o Socket.IO e liga os listeners. Retorna `dispose`, que remove
 * listeners e fecha a conexão (chamado ao trocar de sessão ou desmontar).
 */
export function connectRealtime(
  qc: QueryClient,
  opts: { token: string | null; userId: string | null; transports?: ManagerOptions['transports'] },
) {
  realtimeStatus.set('connecting')
  const socket: Socket = io(SOCKET_URL, {
    // Injetável para testes em Node (onde o transporte padrão usa o pacote `ws`).
    transports: opts.transports ?? ['websocket'],
    auth: opts.token ? { token: opts.token } : {},
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  })

  let firstConnect = true
  const onConnect = () => {
    realtimeStatus.set('connected')
    if (!firstConnect) {
      // Reconexão: eventos podem ter sido perdidos (e o servidor pode ter reiniciado com versões
      // menores). A API REST passa a ser a referência: esquece as versões vistas e reconcilia.
      resetNftVersions()
      void qc.invalidateQueries({ refetchType: 'active' })
    }
    firstConnect = false
  }
  const onDisconnect = () => realtimeStatus.set(socket.active ? 'reconnecting' : 'offline')
  const onConnectError = () => realtimeStatus.set('reconnecting')
  const onNft = (raw: unknown) => {
    const parsed = nftUpdatedEventSchema.safeParse(raw)
    if (parsed.success) applyNftUpdate(qc, parsed.data)
  }
  const onOrder = (raw: unknown) => applyOrderUpdate(qc, opts.userId, raw)

  socket.on('connect', onConnect)
  socket.on('disconnect', onDisconnect)
  socket.on('connect_error', onConnectError)
  socket.on(socketEvents.nftUpdated, onNft)
  socket.on(socketEvents.orderUpdated, onOrder)

  return function dispose() {
    socket.off('connect', onConnect)
    socket.off('disconnect', onDisconnect)
    socket.off('connect_error', onConnectError)
    socket.off(socketEvents.nftUpdated, onNft)
    socket.off(socketEvents.orderUpdated, onOrder)
    socket.disconnect()
    realtimeStatus.set('offline')
  }
}

/** Usado ao trocar de sessão para não carregar versões de uma sessão anterior. */
export function resetRealtimeState() {
  resetNftVersions()
}
