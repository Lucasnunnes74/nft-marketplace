import { z } from 'zod'
import { http } from './client'
import {
  type AuthResponse,
  authResponseSchema,
  type Cart,
  type CartItemBody,
  cartSchema,
  type CreateOrderBody,
  type LoginBody,
  type NftListParams,
  nftDetailSchema,
  nftListSchema,
  type Order,
  orderSchema,
  type PasswordBody,
  type ProfileBody,
  type Quote,
  type QuoteBody,
  quoteSchema,
  type Session,
  type SignupBody,
  sessionSchema,
  type User,
  userSchema,
  type Wallet,
  type WalletBody,
  walletSchema,
  nftSummarySchema,
} from './contracts'

type Opts = { signal?: AbortSignal }

/* ── Catálogo ── */
export async function listNfts(params: Partial<NftListParams>, { signal }: Opts = {}) {
  const query = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== false),
  )
  const { data } = await http.get('/nfts', { params: query, signal })
  return nftListSchema.parse(data)
}

export async function getNft(id: string, { signal }: Opts = {}) {
  const { data } = await http.get(`/nfts/${encodeURIComponent(id)}`, { signal })
  return nftDetailSchema.parse(data)
}

export async function listFeatured({ signal }: Opts = {}) {
  const { data } = await http.get('/nfts', { params: { sort: 'featured', pageSize: 4 }, signal })
  return nftListSchema.parse(data)
}

/* ── Sessão e conta ── */
export async function login(body: LoginBody): Promise<AuthResponse> {
  const { data } = await http.post('/session/login', body)
  return authResponseSchema.parse(data)
}

export async function signup(body: SignupBody): Promise<AuthResponse> {
  const { data } = await http.post('/session/signup', body)
  return authResponseSchema.parse(data)
}

export async function getSession({ signal }: Opts = {}): Promise<Session> {
  const { data } = await http.get('/session', { signal })
  return sessionSchema.parse(data)
}

export async function logout(): Promise<void> {
  await http.post('/session/logout')
}

export async function updateProfile(body: ProfileBody): Promise<User> {
  const { data } = await http.patch('/profile', body)
  return userSchema.parse(data)
}

export async function changePassword(body: PasswordBody): Promise<void> {
  await http.put('/profile/password', body)
}

/* ── Favoritos ── */
export async function listFavorites({ signal }: Opts = {}) {
  const { data } = await http.get('/favorites', { signal })
  return z.array(nftSummarySchema).parse(data)
}

export async function addFavorite(nftId: string) {
  await http.post('/favorites', { nftId })
}

export async function removeFavorite(nftId: string) {
  await http.delete(`/favorites/${encodeURIComponent(nftId)}`)
}

/* ── Carrinho e cotação ── */
export async function getCart({ signal }: Opts = {}): Promise<Cart> {
  const { data } = await http.get('/cart', { signal })
  return cartSchema.parse(data)
}

export async function addCartItem(body: CartItemBody): Promise<Cart> {
  const { data } = await http.post('/cart/items', body)
  return cartSchema.parse(data)
}

export async function setCartItemQuantity(nftId: string, quantity: number): Promise<Cart> {
  const { data } = await http.patch(`/cart/items/${encodeURIComponent(nftId)}`, { quantity })
  return cartSchema.parse(data)
}

export async function removeCartItem(nftId: string): Promise<Cart> {
  const { data } = await http.delete(`/cart/items/${encodeURIComponent(nftId)}`)
  return cartSchema.parse(data)
}

export async function getQuote(body: QuoteBody, { signal }: Opts = {}): Promise<Quote> {
  const { data } = await http.post('/quote', body, { signal })
  return quoteSchema.parse(data)
}

/* ── Pedidos ── */
export async function createOrder(body: CreateOrderBody, idempotencyKey: string): Promise<Order> {
  const { data } = await http.post('/orders', body, { headers: { 'Idempotency-Key': idempotencyKey } })
  return orderSchema.parse(data)
}

export async function getOrder(id: string, { signal }: Opts = {}): Promise<Order> {
  const { data } = await http.get(`/orders/${encodeURIComponent(id)}`, { signal })
  return orderSchema.parse(data)
}

/* ── Carteiras ── */
export async function listWallets({ signal }: Opts = {}): Promise<Wallet[]> {
  const { data } = await http.get('/wallets', { signal })
  return z.array(walletSchema).parse(data)
}

export async function createWallet(body: WalletBody): Promise<Wallet> {
  const { data } = await http.post('/wallets', body)
  return walletSchema.parse(data)
}

export async function updateWallet(id: string, body: Partial<WalletBody>): Promise<Wallet> {
  const { data } = await http.patch(`/wallets/${encodeURIComponent(id)}`, body)
  return walletSchema.parse(data)
}

export async function connectWallet(id: string, network: string): Promise<Wallet> {
  const { data } = await http.post(`/wallets/${encodeURIComponent(id)}/connect`, { network })
  return walletSchema.parse(data)
}

export async function disconnectWallet(id: string): Promise<Wallet> {
  const { data } = await http.post(`/wallets/${encodeURIComponent(id)}/disconnect`)
  return walletSchema.parse(data)
}
