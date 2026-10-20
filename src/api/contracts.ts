/**
 * Contratos REST e eventos Socket.IO.
 *
 * Fonte única de verdade: o cliente (Axios), os handlers MSW e os eventos em
 * tempo real usam os mesmos schemas, então transporte, estado e interface
 * compartilham os mesmos tipos. Valores em ETH sempre trafegam como string
 * decimal ("0.0125"); quantidades são inteiros.
 */
import { z } from 'zod'

export const money = z.string().regex(/^\d+(\.\d{1,18})?$/, 'Valor ETH inválido')

export const networks = ['ethereum', 'polygon', 'arbitrum', 'base'] as const
export const networkSchema = z.enum(networks)
export type Network = z.infer<typeof networkSchema>
export const networkLabels: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  base: 'Base',
}

export const categories = [
  'art',
  'photography',
  'music',
  '3d',
  'collectibles',
  'generative',
  'gaming',
  'subscriptions',
  'utility',
] as const
export const categorySchema = z.enum(categories)
export type Category = z.infer<typeof categorySchema>
export const categoryLabels: Record<Category, string> = {
  art: 'Arte digital',
  photography: 'Fotografia',
  music: 'Música',
  '3d': 'Arte 3D',
  collectibles: 'Colecionáveis',
  generative: 'Generativa',
  gaming: 'Jogos',
  subscriptions: 'Assinaturas',
  utility: 'Utilidade',
}

/** Blockchain em que o NFT foi cunhado (filtro do catálogo); não confundir com a rede de pagamento. */
export const chains = ['ethereum', 'polygon', 'solana'] as const
export const chainSchema = z.enum(chains)
export type Chain = z.infer<typeof chainSchema>
export const chainLabels: Record<Chain, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export const walletProviders = ['walletconnect', 'metamask', 'coinbase'] as const
export const walletProviderSchema = z.enum(walletProviders)
export type WalletProvider = z.infer<typeof walletProviderSchema>
export const walletProviderLabels: Record<WalletProvider, string> = {
  walletconnect: 'WalletConnect',
  metamask: 'MetaMask',
  coinbase: 'Coinbase Wallet',
}

/* ───────────── Erros ───────────── */
export const errorCodes = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'OUT_OF_STOCK',
  'QUANTITY_LIMIT',
  'PRICE_CHANGED',
  'IDEMPOTENCY_CONFLICT',
  'EMPTY_CART',
  'WALLET_DISCONNECTED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const
export type ErrorCode = (typeof errorCodes)[number]

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.enum(errorCodes),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
    details: z.unknown().optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>

/* ───────────── NFTs ───────────── */
export const nftSummarySchema = z.object({
  id: z.string(),
  tokenId: z.string(),
  name: z.string(),
  collection: z.string(),
  creator: z.string(),
  category: categorySchema,
  chain: chainSchema,
  price: money,
  /** Preço antes de uma redução, exibido riscado. */
  previousPrice: money.nullable(),
  available: z.number().int().nonnegative(),
  edition: z.number().int().positive(),
  image: z.string(),
  featured: z.boolean(),
  isFavorite: z.boolean(),
  version: z.number().int().nonnegative(),
})
export type NftSummary = z.infer<typeof nftSummarySchema>

export const nftDetailSchema = nftSummarySchema.extend({
  /** Texto curto ("Sobre este NFT"); `description` é o texto completo da aba de detalhes. */
  summary: z.string(),
  description: z.string(),
  images: z.array(z.string()).min(1),
  attributes: z.array(z.object({ trait: z.string(), value: z.string() })),
  maxPerOrder: z.number().int().positive(),
  createdAt: z.string(),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().nonnegative(),
  contractAddress: z.string(),
  royaltyBps: z.number().int().nonnegative(),
})
export type NftDetail = z.infer<typeof nftDetailSchema>

export const sortOptions = ['featured', 'price_asc', 'price_desc', 'name', 'newest'] as const
export const sortSchema = z.enum(sortOptions)
export type SortOption = z.infer<typeof sortSchema>
export const sortLabels: Record<SortOption, string> = {
  featured: 'Destaques',
  price_asc: 'Menor preço',
  price_desc: 'Maior preço',
  name: 'Nome (A–Z)',
  newest: 'Listados recentemente',
}

export const nftListParamsSchema = z.object({
  q: z.string().optional(),
  category: categorySchema.optional(),
  chain: chainSchema.optional(),
  minPrice: money.optional(),
  maxPrice: money.optional(),
  availableOnly: z.boolean().optional(),
  featuredOnly: z.boolean().optional(),
  /** Apenas listados nos últimos 30 dias (aba "Novos lançamentos"). */
  newOnly: z.boolean().optional(),
  sort: sortSchema.default('newest'),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(48).default(12),
})
export type NftListParams = z.infer<typeof nftListParamsSchema>

export const nftListSchema = z.object({
  items: z.array(nftSummarySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  /** Contagens para os filtros, calculadas ignorando o próprio filtro (como em lojas reais). */
  facets: z.object({
    categories: z.record(categorySchema, z.number().int().nonnegative()),
    chains: z.record(chainSchema, z.number().int().nonnegative()),
    price: z.object({ min: money, max: money }),
  }),
})
export type NftList = z.infer<typeof nftListSchema>

/* ───────────── Sessão e conta ───────────── */
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  email: z.string(),
  ensName: z.string().nullable(),
  referralCode: z.string().nullable(),
  avatar: z.string().nullable(),
  createdAt: z.string(),
})
export type User = z.infer<typeof userSchema>

export const loginBodySchema = z.object({
  email: z.string().min(1, 'Informe o e-mail').pipe(z.email('E-mail inválido')),
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginBody = z.infer<typeof loginBodySchema>

export const passwordRule = z
  .string()
  .min(8, 'Use ao menos 8 caracteres')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número')

export const signupBodySchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome'),
  email: z.string().min(1, 'Informe o e-mail').pipe(z.email('E-mail inválido')),
  password: passwordRule,
})
export type SignupBody = z.infer<typeof signupBodySchema>

export const authResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
  user: userSchema,
})
export type AuthResponse = z.infer<typeof authResponseSchema>

export const sessionSchema = z.object({ user: userSchema, expiresAt: z.string() })
export type Session = z.infer<typeof sessionSchema>

export const usernameRule = z
  .string()
  .trim()
  .min(3, 'Use ao menos 3 caracteres')
  .max(30, 'Use no máximo 30 caracteres')
  .regex(/^[a-z0-9._]+$/i, 'Use apenas letras, números, ponto ou sublinhado')

export const ensLabelRule = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*$|^$/i, 'Use letras, números, hífen e ponto (ex.: nova.kurio)')
  .max(40, 'Use no máximo 40 caracteres')

export const profileBodySchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome'),
  /** Opcional no PATCH: ausente mantém o atual. */
  username: usernameRule.optional(),
  email: z.string().min(1, 'Informe o e-mail').pipe(z.email('E-mail inválido')),
  ensName: ensLabelRule.nullable().optional(),
  referralCode: z.string().trim().max(32, 'Use no máximo 32 caracteres').nullable().optional(),
  avatar: z.string().nullable().optional(),
})
export type ProfileBody = z.infer<typeof profileBodySchema>

export const passwordBodySchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: passwordRule,
})
export type PasswordBody = z.infer<typeof passwordBodySchema>

/* ───────────── Carteiras ───────────── */
export const walletAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Endereço inválido (0x + 40 caracteres hexadecimais)')

export const walletSchema = z.object({
  id: z.string(),
  label: z.string(),
  address: z.string(),
  network: networkSchema,
  provider: walletProviderSchema,
  /** ENS ou endereço secundário associado (opcional). */
  ens: z.string().nullable(),
  isPrimary: z.boolean(),
  connected: z.boolean(),
  createdAt: z.string(),
})
export type Wallet = z.infer<typeof walletSchema>

export const walletBodySchema = z.object({
  label: z.string().trim().min(2, 'Dê um nome à carteira'),
  address: walletAddress,
  network: networkSchema,
  provider: walletProviderSchema.optional(),
  ens: z.string().trim().max(80, 'Use no máximo 80 caracteres').nullable().optional(),
  isPrimary: z.boolean().optional(),
})
export type WalletBody = z.infer<typeof walletBodySchema>

/* ───────────── Carrinho e cotação ───────────── */
export const cartItemSchema = z.object({
  nftId: z.string(),
  tokenId: z.string(),
  name: z.string(),
  edition: z.number().int().positive(),
  image: z.string(),
  unitPrice: money,
  quantity: z.number().int().positive(),
  available: z.number().int().nonnegative(),
  maxQuantity: z.number().int().nonnegative(),
})
export type CartItem = z.infer<typeof cartItemSchema>

export const cartSchema = z.object({
  version: z.number().int().nonnegative(),
  items: z.array(cartItemSchema),
  updatedAt: z.string(),
})
export type Cart = z.infer<typeof cartSchema>

export const cartItemBodySchema = z.object({
  nftId: z.string(),
  quantity: z.number().int().positive(),
})
export type CartItemBody = z.infer<typeof cartItemBodySchema>

export const quoteBodySchema = z.object({
  couponCode: z.string().trim().optional(),
  network: networkSchema.optional(),
})
export type QuoteBody = z.infer<typeof quoteBodySchema>

export const quoteSchema = z.object({
  items: z.array(
    z.object({
      nftId: z.string(),
      name: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: money,
      lineTotal: money,
      available: z.number().int().nonnegative(),
      ok: z.boolean(),
      issue: z.enum(['sold_out', 'insufficient_stock', 'quantity_limit']).nullable(),
    }),
  ),
  subtotal: money,
  discount: money,
  networkFee: money,
  total: money,
  network: networkSchema,
  coupon: z
    .object({
      code: z.string(),
      status: z.enum(['applied', 'invalid', 'expired']),
      message: z.string(),
      percent: z.number().optional(),
    })
    .nullable(),
  hasIssues: z.boolean(),
  cartVersion: z.number().int().nonnegative(),
  quotedAt: z.string(),
})
export type Quote = z.infer<typeof quoteSchema>

/* ───────────── Pedidos ───────────── */
export const orderStatusSchema = z.enum(['pending', 'confirmed', 'rejected'])
export type OrderStatus = z.infer<typeof orderStatusSchema>

export const createOrderBodySchema = z.object({
  walletId: z.string().min(1, 'Selecione uma carteira'),
  network: networkSchema,
  provider: walletProviderSchema.optional(),
  couponCode: z.string().trim().optional(),
  /** Dados do colecionador informados no pagamento (registrados no pedido). */
  collector: z
    .object({
      displayName: z.string().trim().min(2),
      username: z.string().trim().min(3),
      profileName: z.string().trim().min(2),
      email: z.email(),
      referralCode: z.string().trim().max(32).optional(),
      ensName: z.string().trim().max(40).optional(),
      secondaryAddress: z.string().trim().max(80).optional(),
      note: z.string().trim().max(500).optional(),
    })
    .optional(),
  /** Total exibido ao usuário: o servidor revalida e responde 409 se mudou. */
  expectedTotal: money,
})
export type CreateOrderBody = z.infer<typeof createOrderBodySchema>

export const orderSchema = z.object({
  id: z.string(),
  status: orderStatusSchema,
  version: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  items: z.array(
    z.object({
      nftId: z.string(),
      tokenId: z.string(),
      name: z.string(),
      image: z.string(),
      unitPrice: money,
      quantity: z.number().int().positive(),
      lineTotal: money,
    }),
  ),
  subtotal: money,
  discount: money,
  networkFee: money,
  total: money,
  network: networkSchema,
  couponCode: z.string().nullable(),
  wallet: z.object({ label: z.string(), address: z.string(), provider: walletProviderSchema }),
  txHash: z.string().nullable(),
  explorerUrl: z.string().nullable(),
  failureReason: z.string().nullable(),
  simulated: z.literal(true),
})
export type Order = z.infer<typeof orderSchema>

/* ───────────── Socket.IO ───────────── */
export const nftUpdatedEventSchema = z.object({
  id: z.string(),
  price: money,
  available: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
  updatedAt: z.string(),
})
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEventSchema>

export const orderUpdatedEventSchema = z.object({
  orderId: z.string(),
  userId: z.string(),
  status: orderStatusSchema,
  version: z.number().int().nonnegative(),
  updatedAt: z.string(),
  txHash: z.string().nullable().optional(),
  failureReason: z.string().nullable().optional(),
})
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEventSchema>

export const socketEvents = { nftUpdated: 'nft.updated', orderUpdated: 'order.updated' } as const
