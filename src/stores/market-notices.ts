import { createStore } from './create-store'

/** Mudanças de preço/estoque recebidas em tempo real que afetam o carrinho do usuário. */
export type MarketNotice = {
  id: string
  nftId: string
  name: string
  kind: 'price' | 'stock'
  from: string
  to: string
  at: number
}

export const marketNotices = createStore<MarketNotice[]>([])

export function pushNotice(n: Omit<MarketNotice, 'id' | 'at'>) {
  marketNotices.set((prev) => [
    ...prev.filter((p) => !(p.nftId === n.nftId && p.kind === n.kind)),
    { ...n, id: `${n.nftId}-${n.kind}-${Date.now()}`, at: Date.now() },
  ])
}

export function dismissNotice(id: string) {
  marketNotices.set((prev) => prev.filter((n) => n.id !== id))
}

export function clearNotices() {
  marketNotices.set([])
}
