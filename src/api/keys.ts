import type { NftListParams } from './contracts'

/** Chaves de cache centralizadas: invalidação coerente após mutations e eventos. */
export const qk = {
  session: ['session'] as const,
  nfts: {
    all: ['nfts'] as const,
    list: (params: Partial<NftListParams>) => ['nfts', 'list', params] as const,
    featured: ['nfts', 'featured'] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
  },
  favorites: ['favorites'] as const,
  cart: ['cart'] as const,
  quote: (coupon: string, network: string) => ['quote', { coupon, network }] as const,
  wallets: ['wallets'] as const,
  order: (id: string) => ['orders', id] as const,
}
