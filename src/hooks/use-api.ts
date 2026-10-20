import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import * as api from '@/api/resources'
import {
  type Cart,
  type CreateOrderBody,
  type LoginBody,
  type Network,
  type NftDetail,
  type NftList,
  type NftListParams,
  type NftSummary,
  type PasswordBody,
  type ProfileBody,
  type SignupBody,
  type Wallet,
  type WalletBody,
} from '@/api/contracts'
import { ApiError, toApiError } from '@/api/errors'
import { qk } from '@/api/keys'
import { reconcileNft, reconcileNftList } from '@/realtime/nft-versions'
import { clearGuestId, sessionStore } from '@/auth/session-store'
import { useSessionState } from '@/auth/use-session'
import { sleep, uid } from '@/lib/utils'
import { toast } from '@/stores/toasts'

/* ───────────── sessão ───────────── */
export function useCurrentUser() {
  const { isAuthenticated } = useSessionState()
  return useQuery({
    queryKey: qk.session,
    queryFn: ({ signal }) => api.getSession({ signal }),
    enabled: isAuthenticated,
    staleTime: 60_000,
  })
}

function startSession(res: { token: string; expiresAt: string; user: { id: string } }) {
  clearGuestId()
  sessionStore.start({ token: res.token, expiresAt: res.expiresAt, userId: res.user.id })
}

export function useLogin() {
  return useMutation({ mutationFn: (body: LoginBody) => api.login(body), onSuccess: startSession })
}

export function useSignup() {
  return useMutation({ mutationFn: (body: SignupBody) => api.signup(body), onSuccess: startSession })
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      try {
        await api.logout()
      } catch {
        // Mesmo que a API falhe, a sessão local é encerrada: logout nunca deve ficar preso.
      }
    },
    onSettled: () => sessionStore.end('logout'),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ProfileBody) => api.updateProfile(body),
    onSuccess: (user) => {
      qc.setQueryData(qk.session, (old: { expiresAt: string } | undefined) =>
        old ? { ...old, user } : undefined,
      )
      void qc.invalidateQueries({ queryKey: qk.session })
    },
  })
}

export function useChangePassword() {
  return useMutation({ mutationFn: (body: PasswordBody) => api.changePassword(body) })
}

/* ───────────── catálogo ───────────── */
/** Função própria com retorno declarado: mantém o tipo do `useQuery` estável com `keepPreviousData`. */
async function fetchNftList(params: Partial<NftListParams>, signal: AbortSignal): Promise<NftList> {
  return reconcileNftList(await api.listNfts(params, { signal }))
}

export function useNftList(params: Partial<NftListParams>) {
  const { userId } = useSessionState()
  return useQuery({
    // userId na chave: dados de um usuário (isFavorite) nunca são reaproveitados por outro.
    queryKey: [...qk.nfts.list(params), userId],
    // `signal` cancela a requisição anterior ao mudar filtros (sem respostas obsoletas).
    queryFn: ({ signal }) => fetchNftList(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useFeatured() {
  const { userId } = useSessionState()
  return useQuery({
    queryKey: [...qk.nfts.featured, userId],
    queryFn: ({ signal }) => api.listFeatured({ signal }).then((list): NftList => reconcileNftList<NftList>(list)),
  })
}

export function useNft(id: string) {
  const { userId } = useSessionState()
  return useQuery({
    queryKey: [...qk.nfts.detail(id), userId],
    queryFn: ({ signal }) => api.getNft(id, { signal }).then((nft): NftDetail => reconcileNft<NftDetail>(nft)),
    retry: (count, error) => !(error instanceof ApiError && error.code === 'NOT_FOUND') && count < 2,
  })
}

/* ───────────── favoritos (atualização otimista com rollback) ───────────── */
function patchFavoriteEverywhere(qc: QueryClient, nftId: string, isFavorite: boolean) {
  qc.setQueriesData<NftDetail | NftList>({ queryKey: qk.nfts.all }, (old) => {
    if (!old) return old
    if ('items' in old) {
      return { ...old, items: old.items.map((i) => (i.id === nftId ? { ...i, isFavorite } : i)) }
    }
    return old.id === nftId ? { ...old, isFavorite } : old
  })
}

export function useFavorites() {
  const { isAuthenticated, userId } = useSessionState()
  return useQuery({
    queryKey: [...qk.favorites, userId],
    queryFn: ({ signal }) => api.listFavorites({ signal }).then((items): NftSummary[] => items.map((i) => reconcileNft<NftSummary>(i))),
    enabled: isAuthenticated,
  })
}

export function useToggleFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ nftId, next }: { nftId: string; next: boolean }) =>
      next ? api.addFavorite(nftId) : api.removeFavorite(nftId),
    onMutate: async ({ nftId, next }) => {
      await qc.cancelQueries({ queryKey: qk.nfts.all })
      await qc.cancelQueries({ queryKey: qk.favorites })
      const snapshotNfts = qc.getQueriesData<NftDetail | NftList>({ queryKey: qk.nfts.all })
      const snapshotFavs = qc.getQueriesData<NftSummary[]>({ queryKey: qk.favorites })
      patchFavoriteEverywhere(qc, nftId, next)
      if (!next) {
        qc.setQueriesData<NftSummary[]>({ queryKey: qk.favorites }, (old) => old?.filter((f) => f.id !== nftId))
      }
      return { snapshotNfts, snapshotFavs }
    },
    onError: (error, _vars, ctx) => {
      // Rollback do estado otimista.
      for (const [key, data] of ctx?.snapshotNfts ?? []) qc.setQueryData(key, data)
      for (const [key, data] of ctx?.snapshotFavs ?? []) qc.setQueryData(key, data)
      toast({
        title: 'Não foi possível atualizar o favorito',
        description: toApiError(error).message,
        variant: 'destructive',
      })
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.favorites })
    },
  })
}

/* ───────────── carrinho (otimista na quantidade/remoção) ───────────── */
export function useCart() {
  const { userId } = useSessionState()
  return useQuery({
    queryKey: [...qk.cart, userId ?? 'guest'],
    queryFn: ({ signal }) => api.getCart({ signal }),
  })
}

/** Chave do carrinho do usuário atual (visitante ou autenticado). */
function useCartKey() {
  const { userId } = useSessionState()
  return [...qk.cart, userId ?? 'guest'] as const
}

export function useAddToCart() {
  const qc = useQueryClient()
  const key = useCartKey()
  return useMutation({
    mutationFn: (vars: { nftId: string; quantity: number }) => api.addCartItem(vars),
    onSuccess: (cart) => {
      qc.setQueryData(key, cart)
      void qc.invalidateQueries({ queryKey: ['quote'] })
    },
  })
}

export function useSetCartQuantity() {
  const qc = useQueryClient()
  const key = useCartKey()
  return useMutation({
    mutationFn: (vars: { nftId: string; quantity: number }) => api.setCartItemQuantity(vars.nftId, vars.quantity),
    onMutate: async ({ nftId, quantity }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Cart>(key)
      if (previous) {
        qc.setQueryData<Cart>(key, {
          ...previous,
          items: previous.items.map((i) => (i.nftId === nftId ? { ...i, quantity } : i)),
        })
      }
      return { previous }
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
      toast({ title: 'Não foi possível alterar a quantidade', description: toApiError(error).message, variant: 'warning' })
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key })
      void qc.invalidateQueries({ queryKey: ['quote'] })
    },
  })
}

export function useRemoveCartItem() {
  const qc = useQueryClient()
  const key = useCartKey()
  return useMutation({
    mutationFn: (nftId: string) => api.removeCartItem(nftId),
    onMutate: async (nftId) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Cart>(key)
      if (previous) qc.setQueryData<Cart>(key, { ...previous, items: previous.items.filter((i) => i.nftId !== nftId) })
      return { previous }
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
      toast({ title: 'Não foi possível remover o item', description: toApiError(error).message, variant: 'destructive' })
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key })
      void qc.invalidateQueries({ queryKey: ['quote'] })
    },
  })
}

export function useQuote(args: { coupon: string; network: Network; enabled: boolean }) {
  const { userId } = useSessionState()
  return useQuery({
    queryKey: [...qk.quote(args.coupon, args.network), userId ?? 'guest'],
    queryFn: ({ signal }) => api.getQuote({ couponCode: args.coupon || undefined, network: args.network }, { signal }),
    enabled: args.enabled,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })
}

/* ───────────── carteiras ───────────── */
export function useWallets() {
  const { isAuthenticated, userId } = useSessionState()
  return useQuery({
    queryKey: [...qk.wallets, userId],
    queryFn: ({ signal }) => api.listWallets({ signal }),
    enabled: isAuthenticated,
  })
}

export function useCreateWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: WalletBody) => api.createWallet(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.wallets }),
  })
}

export function useUpdateWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<WalletBody> }) => api.updateWallet(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.wallets }),
  })
}

export function useConnectWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, network }: { id: string; network: Network }) => api.connectWallet(id, network),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.wallets }),
  })
}

export function useDisconnectWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.disconnectWallet(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.wallets }),
  })
}

export type { Wallet }

/* ───────────── pedidos ───────────── */
export function useOrder(id: string) {
  return useQuery({
    queryKey: qk.order(id),
    queryFn: ({ signal }) => api.getOrder(id, { signal }),
    // Rede de segurança além do Socket.IO: enquanto pendente, reconcilia periodicamente.
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 3000 : false),
    retry: (count, error) => !(error instanceof ApiError && error.code === 'NOT_FOUND') && count < 2,
  })
}

const IDEM_PREFIX = 'nft.idem.'

function fingerprintOf(body: CreateOrderBody) {
  return JSON.stringify([body.walletId, body.network, (body.couponCode ?? '').toUpperCase(), body.expectedTotal])
}

/**
 * Cria o pedido com Idempotency-Key estável por conteúdo: reenvios do mesmo
 * pedido (duplo clique, timeout, refresh) devolvem o mesmo pedido. Se o
 * conteúdo mudar (ex.: usuário revisou um novo total), uma nova chave é usada.
 */
export function usePlaceOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateOrderBody) => {
      const fp = fingerprintOf(body)
      let key: string | null = null
      try {
        key = sessionStorage.getItem(IDEM_PREFIX + fp)
      } catch {
        /* noop */
      }
      if (!key) {
        key = uid('idem')
        try {
          sessionStorage.setItem(IDEM_PREFIX + fp, key)
        } catch {
          /* noop */
        }
      }
      let lastError: unknown
      // Timeout/queda de rede: o pedido pode ter sido criado. Repete COM A MESMA chave.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await api.createOrder(body, key)
        } catch (error) {
          lastError = error
          const e = toApiError(error)
          if (e.code !== 'TIMEOUT' && e.code !== 'NETWORK') throw e
          await sleep(1000 * (attempt + 1))
        }
      }
      throw toApiError(lastError)
    },
    onSuccess: (order) => {
      qc.setQueryData(qk.order(order.id), order)
      void qc.invalidateQueries({ queryKey: qk.cart })
      void qc.invalidateQueries({ queryKey: ['quote'] })
      void qc.invalidateQueries({ queryKey: qk.nfts.all })
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i)
          if (k?.startsWith(IDEM_PREFIX)) sessionStorage.removeItem(k)
        }
      } catch {
        /* noop */
      }
    },
  })
}
