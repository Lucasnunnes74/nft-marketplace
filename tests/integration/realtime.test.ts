import { QueryClient } from '@tanstack/react-query'
import { WebSocket as BrowserWebSocket } from 'engine.io-client'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { NftDetail, Order } from '@/api/contracts'
import { qk } from '@/api/keys'
import * as api from '@/api/resources'
import { sessionStore } from '@/auth/session-store'
import { db, patchNft } from '@/mocks/db'
import { handlers } from '@/mocks/handlers'
import { connectionCount, dropConnections, emitNftUpdated, emitOrderUpdated } from '@/mocks/realtime'
import { scenarioStore } from '@/mocks/scenario'
import { connectRealtime, resetRealtimeState } from '@/realtime/socket'
import { marketNotices } from '@/stores/market-notices'
import { realtimeStatus } from '@/stores/realtime-status'

/**
 * Socket.IO real (socket.io-client) conectado ao servidor simulado,
 * interceptado na camada de rede por MSW (@mswjs/socket.io-binding).
 */
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterAll(() => server.close())

/**
 * Em Node o transporte padrão do socket.io-client usa o pacote `ws`, e o transporte "de navegador"
 * captura `globalThis.WebSocket` na importação (antes do MSW). Esta subclasse resolve o WebSocket global
 * na hora da conexão, reproduzindo o que acontece no navegador depois que o MSW inicia.
 */
class LiveWebSocket extends BrowserWebSocket {
  createSocket(uri: string, protocols: string | string[] | undefined) {
    return new globalThis.WebSocket(uri, protocols) as never
  }
}
const transport = { transports: [LiveWebSocket] as never }

let qc: QueryClient
let dispose: (() => void) | undefined

beforeEach(() => {
  localStorage.clear()
  db.reset()
  scenarioStore.reset()
  sessionStore.end('logout')
  resetRealtimeState()
  marketNotices.set([])
  qc = new QueryClient()
})
afterEach(() => dispose?.())

const until = async (cond: () => boolean, ms = 8000) => {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('timeout aguardando condição')
    await new Promise((r) => setTimeout(r, 25))
  }
}

async function seedDetail(id: string) {
  const key = [...qk.nfts.detail(id), null]
  await qc.fetchQuery({ queryKey: key, queryFn: () => api.getNft(id) })
  return key
}

describe('Socket.IO em tempo real (cliente real + MSW)', () => {
  it('conecta ao servidor simulado e informa o status', async () => {
    dispose = connectRealtime(qc, { token: null, userId: null, ...transport })
    await until(() => realtimeStatus.get() === 'connected')
    expect(connectionCount()).toBe(1)
  })

  it('nft.updated atualiza preço/estoque nos caches de detalhe e lista', async () => {
    const detailKey = await seedDetail('nft-001')
    const listKey = ['nfts', 'list', {}, null]
    qc.setQueryData(listKey, await api.listNfts({}))
    dispose = connectRealtime(qc, { token: null, userId: null, ...transport })
    await until(() => realtimeStatus.get() === 'connected')

    const evt = patchNft('nft-001', { price: '0.7777', available: 3 })
    expect(evt).toBeTruthy()
    emitNftUpdated(evt!)

    await until(() => qc.getQueryData<NftDetail>(detailKey)?.price === '0.7777')
    expect(qc.getQueryData<NftDetail>(detailKey)).toMatchObject({ price: '0.7777', available: 3 })
    const list = qc.getQueryData<{ items: { id: string; price: string }[] }>(listKey)
    expect(list?.items.find((i) => i.id === 'nft-001')?.price).toBe('0.7777')
  })

  it('ignora eventos duplicados e fora de ordem (versão antiga não regride o estado)', async () => {
    const detailKey = await seedDetail('nft-001')
    dispose = connectRealtime(qc, { token: null, userId: null, ...transport })
    await until(() => realtimeStatus.get() === 'connected')

    const v1 = patchNft('nft-001', { price: '0.5' })!
    const v2 = patchNft('nft-001', { price: '0.6' })!
    emitNftUpdated(v2) // chega primeiro (mais novo)
    await until(() => qc.getQueryData<NftDetail>(detailKey)?.price === '0.6')
    emitNftUpdated(v1) // evento antigo chega depois
    emitNftUpdated(v2) // duplicado
    await new Promise((r) => setTimeout(r, 300))
    expect(qc.getQueryData<NftDetail>(detailKey)?.price).toBe('0.6')
    expect(qc.getQueryData<NftDetail>(detailKey)?.version).toBe(v2.version)
  })

  it('mudança de preço de item no carrinho gera aviso para o usuário', async () => {
    await api.addCartItem({ nftId: 'nft-001', quantity: 1 })
    qc.setQueryData([...qk.cart, 'guest'], await api.getCart())
    dispose = connectRealtime(qc, { token: null, userId: null, ...transport })
    await until(() => realtimeStatus.get() === 'connected')

    emitNftUpdated(patchNft('nft-001', { price: '0.9' })!)
    await until(() => marketNotices.get().length > 0)
    expect(marketNotices.get()[0]).toMatchObject({ nftId: 'nft-001', kind: 'price' })
  })

  it('order.updated só atualiza o usuário dono do pedido', async () => {
    const order = { id: 'ord_x', status: 'pending', version: 1, txHash: null, failureReason: null, updatedAt: '' } as unknown as Order
    qc.setQueryData(qk.order('ord_x'), order)
    dispose = connectRealtime(qc, { token: 'tok', userId: 'user-demo', ...transport })
    await until(() => realtimeStatus.get() === 'connected')

    emitOrderUpdated({ orderId: 'ord_x', userId: 'user-ana', status: 'confirmed', version: 2, updatedAt: new Date().toISOString(), txHash: '0xabc' })
    await new Promise((r) => setTimeout(r, 300))
    expect(qc.getQueryData<Order>(qk.order('ord_x'))?.status).toBe('pending') // outro usuário: ignorado

    emitOrderUpdated({ orderId: 'ord_x', userId: 'user-demo', status: 'confirmed', version: 2, updatedAt: new Date().toISOString(), txHash: '0xabc' })
    await until(() => qc.getQueryData<Order>(qk.order('ord_x'))?.status === 'confirmed')

    // versão antiga/duplicada não regride
    emitOrderUpdated({ orderId: 'ord_x', userId: 'user-demo', status: 'rejected', version: 1, updatedAt: '' })
    await new Promise((r) => setTimeout(r, 300))
    expect(qc.getQueryData<Order>(qk.order('ord_x'))?.status).toBe('confirmed')
  })

  it('reconecta após queda e reconcilia os dados ativos com a API REST', async () => {
    await seedDetail('nft-001')
    dispose = connectRealtime(qc, { token: null, userId: null, ...transport })
    await until(() => realtimeStatus.get() === 'connected')

    let refetched = false
    qc.getQueryCache().subscribe((e) => {
      if (e.type === 'updated' && e.action.type === 'invalidate') refetched = true
    })
    dropConnections()
    await until(() => realtimeStatus.get() !== 'connected', 3000).catch(() => undefined)
    await until(() => realtimeStatus.get() === 'connected' && connectionCount() === 1, 15_000)
    await until(() => refetched, 5000)
  }, 30_000)

  it('dispose solta listeners e encerra a conexão', async () => {
    dispose = connectRealtime(qc, { token: null, userId: null, ...transport })
    await until(() => realtimeStatus.get() === 'connected')
    dispose()
    dispose = undefined
    await until(() => connectionCount() === 0)
    expect(realtimeStatus.get()).toBe('offline')
  })
})
