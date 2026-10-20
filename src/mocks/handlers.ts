import { delay, http, HttpResponse, type StrictRequest } from 'msw'
import type { z } from 'zod'
import {
  type ApiErrorBody,
  createOrderBodySchema,
  type ErrorCode,
  loginBodySchema,
  type Network,
  type NftListParams,
  nftListParamsSchema,
  type Order,
  passwordBodySchema,
  profileBodySchema,
  type Quote,
  quoteBodySchema,
  signupBodySchema,
  walletBodySchema,
  cartItemBodySchema,
  type NftSummary,
  type NftDetail,
  type NftList,
  categories,
  chains,
} from '@/api/contracts'
import { addEth, cmpEth, eqEth, mulEth, pctEth, subEth } from '@/lib/eth'
import {
  allLiveNfts,
  db,
  liveNft,
  maxQuantityFor,
  type OrderRecord,
  patchNft,
  randomHex,
  scalePrice,
  type UserRecord,
  type LiveNft,
  type WalletRecord,
} from './db'
import { hashPassword } from './password'
import { emitNftUpdated, emitOrderUpdated, realtimeHandlers } from './realtime'
import { latencyMs, scenarioStore } from './scenario'
import { COUPONS, NETWORK_FEES, SESSION_TTL_MS } from './seed'

/* ───────────── utilidades HTTP ───────────── */
function fail(
  status: number,
  code: ErrorCode,
  message: string,
  extra: { fields?: Record<string, string>; details?: unknown } = {},
) {
  const body: ApiErrorBody = { error: { code, message, ...extra } }
  return HttpResponse.json(body, { status })
}

async function parseBody<S extends z.ZodType>(request: Request, schema: S) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return { ok: false as const, response: fail(400 as number, 'VALIDATION_ERROR', 'Corpo da requisição inválido.') }
  }
  const parsed = schema.safeParse(json)
  if (parsed.success) return { ok: true as const, data: parsed.data as z.output<S> }
  const fields: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? '_')
    if (!fields[key]) fields[key] = issue.message
  }
  return {
    ok: false as const,
    response: fail(422, 'VALIDATION_ERROR', 'Verifique os campos informados.', { fields }),
  }
}

type AuthResult = { user: UserRecord; token: string } | { response: Response }

function bearer(request: Request) {
  const header = request.headers.get('authorization')
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

/** Valida a sessão. Retorna { response } já pronto para 401 quando inválida. */
function authenticate(request: Request): AuthResult {
  const token = bearer(request)
  if (!token) return { response: fail(401, 'UNAUTHENTICATED', 'Faça login para continuar.') }
  const session = db.state.sessions[token]
  if (!session) return { response: fail(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.') }
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    delete db.state.sessions[token]
    db.save()
    return { response: fail(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.') }
  }
  const user = db.state.users.find((u) => u.id === session.userId)
  if (!user) return { response: fail(401, 'UNAUTHENTICATED', 'Sessão inválida.') }
  return { user, token }
}

/** Usuário opcional: sem token = visitante; token inválido = 401 (o cliente encerra a sessão). */
function optionalAuth(request: Request): { user: UserRecord | null } | { response: Response } {
  if (!bearer(request)) return { user: null }
  const auth = authenticate(request)
  return 'response' in auth ? auth : { user: auth.user }
}

function ownerKey(request: Request, user: UserRecord | null) {
  if (user) return `user:${user.id}`
  return `guest:${request.headers.get('x-guest-id') ?? 'anonymous'}`
}

/** Aplica latência e falhas do cenário ativo a qualquer rota da API. */
function scenarioed<Args extends { request: StrictRequest<any> }>(
  resolver: (args: Args & { params: Record<string, string | readonly string[] | undefined> }) => Promise<Response> | Response,
) {
  return async (args: Args & { params: Record<string, string | readonly string[] | undefined> }) => {
    const sc = scenarioStore.get()
    await delay(latencyMs(sc.latency))
    if (sc.failure === 'network') return HttpResponse.error()
    if (sc.failure === '500') return fail(500, 'INTERNAL_ERROR', 'Erro interno do servidor.')
    if (sc.failure === '503') return fail(503, 'SERVICE_UNAVAILABLE', 'Serviço temporariamente indisponível.')
    return resolver(args)
  }
}

/* ───────────── domínio ───────────── */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function toSummary(n: LiveNft, userId: string | null): NftSummary {
  return {
    id: n.id,
    tokenId: n.tokenId,
    name: n.name,
    collection: n.collection,
    creator: n.creator,
    category: n.category,
    chain: n.chain,
    price: n.price,
    previousPrice: n.previousPrice,
    available: n.available,
    edition: n.edition,
    image: n.image,
    featured: n.featured,
    isFavorite: userId ? (db.state.favorites[userId] ?? []).includes(n.id) : false,
    version: n.version,
  }
}

function toDetail(n: LiveNft, userId: string | null): NftDetail {
  return {
    ...toSummary(n, userId),
    summary: n.summary,
    description: n.description,
    images: n.images,
    attributes: n.attributes,
    maxPerOrder: maxQuantityFor(Math.max(n.available, 1)),
    createdAt: n.createdAt,
    rating: n.rating,
    reviewCount: n.reviewCount,
    contractAddress: n.contractAddress,
    royaltyBps: n.royaltyBps,
  }
}

function serializeWallet(userId: string, w: WalletRecord) {
  return { ...w, connected: db.state.connections[userId] === w.id }
}

function serializeCart(key: string) {
  const record = db.state.carts[key] ?? { version: 0, items: [], updatedAt: new Date().toISOString() }
  const items = record.items.flatMap((i) => {
    const n = liveNft(i.nftId)
    if (!n) return []
    return [
      {
        nftId: n.id,
        tokenId: n.tokenId,
        name: n.name,
        edition: n.edition,
        image: n.image,
        unitPrice: n.price,
        quantity: i.quantity,
        available: n.available,
        maxQuantity: maxQuantityFor(n.available),
      },
    ]
  })
  return { version: record.version, items, updatedAt: record.updatedAt }
}

function touchCart(key: string) {
  const cart = (db.state.carts[key] ??= { version: 0, items: [], updatedAt: '' })
  cart.version += 1
  cart.updatedAt = new Date().toISOString()
  db.save()
  return cart
}

function mergeGuestCart(guestId: string | null, userId: string) {
  if (!guestId) return
  const guestKey = `guest:${guestId}`
  const guest = db.state.carts[guestKey]
  if (!guest || guest.items.length === 0) return
  const userKey = `user:${userId}`
  const cart = (db.state.carts[userKey] ??= { version: 0, items: [], updatedAt: '' })
  for (const gi of guest.items) {
    const n = liveNft(gi.nftId)
    if (!n) continue
    const existing = cart.items.find((i) => i.nftId === gi.nftId)
    const cap = Math.max(maxQuantityFor(n.available), 1)
    if (existing) existing.quantity = Math.min(existing.quantity + gi.quantity, cap)
    else cart.items.push({ nftId: gi.nftId, quantity: Math.min(gi.quantity, cap) })
  }
  cart.version += 1
  cart.updatedAt = new Date().toISOString()
  delete db.state.carts[guestKey]
  db.save()
}

function computeQuote(key: string, couponCode: string | undefined, network: Network = 'ethereum'): Quote {
  const cart = db.state.carts[key] ?? { version: 0, items: [], updatedAt: '' }
  const items: Quote['items'] = cart.items.flatMap((ci) => {
    const n = liveNft(ci.nftId)
    if (!n) return []
    let issue: Quote['items'][number]['issue'] = null
    if (n.available === 0) issue = 'sold_out'
    else if (ci.quantity > n.available) issue = 'insufficient_stock'
    else if (ci.quantity > maxQuantityFor(n.available)) issue = 'quantity_limit'
    return [
      {
        nftId: n.id,
        name: n.name,
        quantity: ci.quantity,
        unitPrice: n.price,
        lineTotal: mulEth(n.price, ci.quantity),
        available: n.available,
        ok: issue === null,
        issue,
      },
    ]
  })
  const subtotal = addEth('0', ...items.map((i) => i.lineTotal))
  const code = couponCode?.trim().toUpperCase() || ''
  let coupon: Quote['coupon'] = null
  let discount = '0'
  if (code) {
    const def = COUPONS[code]
    if (!def) coupon = { code, status: 'invalid', message: 'Cupom inválido.' }
    else if (def.expired) coupon = { code, status: 'expired', message: 'Este cupom expirou.' }
    else {
      discount = pctEth(subtotal, def.percentBps)
      coupon = { code, status: 'applied', message: `Cupom aplicado: ${def.label}.`, percent: def.percentBps / 100 }
    }
  }
  const networkFee = items.length ? NETWORK_FEES[network] : '0'
  const total = items.length ? addEth(subEth(subtotal, discount), networkFee) : '0'
  return {
    items,
    subtotal,
    discount,
    networkFee,
    total,
    network,
    coupon,
    hasIssues: items.some((i) => !i.ok),
    cartVersion: cart.version,
    quotedAt: new Date().toISOString(),
  }
}

function serializeOrder(o: OrderRecord): Order {
  return {
    id: o.id,
    status: o.status,
    version: o.version,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    items: o.items,
    subtotal: o.subtotal,
    discount: o.discount,
    networkFee: o.networkFee,
    total: o.total,
    network: o.network,
    couponCode: o.couponCode,
    wallet: o.wallet,
    txHash: o.txHash,
    explorerUrl: o.txHash ? `https://sepolia.etherscan.io/tx/${o.txHash}` : null,
    failureReason: o.failureReason,
    simulated: true,
  }
}

/** Conclui um pedido pendente (confirmação ou recusa) e notifica em tempo real. */
export function settleOrder(order: OrderRecord) {
  if (order.status !== 'pending') return
  order.version += 1
  order.updatedAt = new Date().toISOString()
  if (order.outcome === 'confirmed') {
    order.status = 'confirmed'
    order.txHash = `0x${randomHex(32)}`
    // Remove do carrinho apenas o que foi comprado.
    const cart = db.state.carts[`user:${order.userId}`]
    if (cart) {
      for (const it of order.items) {
        const ci = cart.items.find((c) => c.nftId === it.nftId)
        if (ci) ci.quantity -= it.quantity
      }
      cart.items = cart.items.filter((c) => c.quantity > 0)
      cart.version += 1
      cart.updatedAt = order.updatedAt
    }
  } else {
    order.status = 'rejected'
    order.failureReason = 'Pagamento recusado pela carteira. Nenhum valor foi cobrado.'
    // Devolve o estoque reservado.
    for (const it of order.items) {
      const n = liveNft(it.nftId)
      if (!n) continue
      const evt = patchNft(it.nftId, { available: n.available + it.quantity })
      if (evt) emitNftUpdated(evt)
    }
  }
  db.save()
  emitOrderUpdated({
    orderId: order.id,
    userId: order.userId,
    status: order.status,
    version: order.version,
    updatedAt: order.updatedAt,
    txHash: order.txHash,
    failureReason: order.failureReason,
  })
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleSettle(order: OrderRecord) {
  if (timers.has(order.id) || order.status !== 'pending') return
  const wait = Math.max(0, order.settleAt - Date.now())
  timers.set(
    order.id,
    setTimeout(() => {
      timers.delete(order.id)
      const current = db.state.orders[order.id]
      if (current) settleOrder(current)
    }, wait),
  )
}

/** Após um refresh, pedidos pendentes retomam a liquidação simulada. */
export function resumePendingOrders() {
  for (const o of Object.values(db.state.orders)) if (o.status === 'pending') scheduleSettle(o)
}

/* ───────────── handlers ───────────── */
const sleepMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export const handlers = [
  /* Catálogo */
  http.get(
    '/api/nfts',
    scenarioed(({ request }) => {
      const auth = optionalAuth(request)
      if ('response' in auth) return auth.response
      const url = new URL(request.url)
      const sp = url.searchParams
      const raw = {
        q: sp.get('q') ?? undefined,
        category: sp.get('category') ?? undefined,
        chain: sp.get('chain') ?? undefined,
        minPrice: sp.get('minPrice') ?? undefined,
        maxPrice: sp.get('maxPrice') ?? undefined,
        availableOnly: sp.get('availableOnly') === 'true' ? true : undefined,
        featuredOnly: sp.get('featuredOnly') === 'true' ? true : undefined,
        newOnly: sp.get('newOnly') === 'true' ? true : undefined,
        sort: sp.get('sort') ?? undefined,
        page: sp.has('page') ? Number(sp.get('page')) : undefined,
        pageSize: sp.has('pageSize') ? Number(sp.get('pageSize')) : undefined,
      }
      const parsed = nftListParamsSchema.safeParse(raw)
      if (!parsed.success) {
        const fields: Record<string, string> = {}
        for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message
        return fail(422, 'VALIDATION_ERROR', 'Parâmetros de busca inválidos.', { fields })
      }
      const p: NftListParams = parsed.data
      // Facetas de um filtro ignoram o próprio filtro (contagens úteis mesmo com ele ativo).
      const q = p.q ? norm(p.q) : ''
      const latest = allLiveNfts().reduce((m, n) => (n.createdAt > m ? n.createdAt : m), '')
      const newSince = latest ? new Date(new Date(latest).getTime() - 30 * 86_400_000).toISOString() : ''
      const filters = {
        q: (n: LiveNft) => !q || norm(`${n.name} ${n.collection} ${n.creator}`).includes(q),
        category: (n: LiveNft) => !p.category || n.category === p.category,
        chain: (n: LiveNft) => !p.chain || n.chain === p.chain,
        price: (n: LiveNft) =>
          (!p.minPrice || cmpEth(n.price, p.minPrice) >= 0) && (!p.maxPrice || cmpEth(n.price, p.maxPrice) <= 0),
        available: (n: LiveNft) => !p.availableOnly || n.available > 0,
        featured: (n: LiveNft) => !p.featuredOnly || n.featured,
        recent: (n: LiveNft) => !p.newOnly || n.createdAt >= newSince,
      }
      type FilterKey = keyof typeof filters
      const all = allLiveNfts()
      const matching = (except?: FilterKey) =>
        all.filter((n) => (Object.keys(filters) as FilterKey[]).every((k) => k === except || filters[k](n)))
      let list = matching()
      const byCategory = matching('category')
      const byChain = matching('chain')
      const prices = all.map((n) => n.price).sort(cmpEth)
      const facets: NftList['facets'] = {
        categories: Object.fromEntries(
          categories.map((c) => [c, byCategory.filter((n) => n.category === c).length]),
        ) as NftList['facets']['categories'],
        chains: Object.fromEntries(
          chains.map((c) => [c, byChain.filter((n) => n.chain === c).length]),
        ) as NftList['facets']['chains'],
        price: { min: prices[0] ?? '0', max: prices[prices.length - 1] ?? '0' },
      }
      const sorters: Record<string, (a: LiveNft, b: LiveNft) => number> = {
        featured: (a, b) => Number(b.featured) - Number(a.featured) || a.id.localeCompare(b.id),
        price_asc: (a, b) => cmpEth(a.price, b.price) || a.id.localeCompare(b.id),
        price_desc: (a, b) => cmpEth(b.price, a.price) || a.id.localeCompare(b.id),
        name: (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
        newest: (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
      }
      list = [...list].sort(sorters[p.sort])
      const total = list.length
      const totalPages = Math.ceil(total / p.pageSize)
      const start = (p.page - 1) * p.pageSize
      const items = list.slice(start, start + p.pageSize).map((n) => toSummary(n, auth.user?.id ?? null))
      return HttpResponse.json({ items, total, page: p.page, pageSize: p.pageSize, totalPages, facets })
    }),
  ),

  http.get(
    '/api/nfts/:id',
    scenarioed(({ request, params }) => {
      const auth = optionalAuth(request)
      if ('response' in auth) return auth.response
      const n = liveNft(String(params.id))
      if (!n) return fail(404, 'NOT_FOUND', 'Este NFT não existe ou foi removido.')
      return HttpResponse.json(toDetail(n, auth.user?.id ?? null))
    }),
  ),

  /* Sessão */
  http.post(
    '/api/session/login',
    scenarioed(async ({ request }) => {
      const body = await parseBody(request, loginBodySchema)
      if (!body.ok) return body.response
      const user = db.state.users.find((u) => u.email.toLowerCase() === body.data.email.toLowerCase())
      if (!user || user.passwordHash !== (await hashPassword(user.id, body.data.password))) {
        return fail(401, 'UNAUTHENTICATED', 'E-mail ou senha incorretos.')
      }
      const token = `tok_${randomHex(16)}`
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
      db.state.sessions[token] = { userId: user.id, expiresAt }
      mergeGuestCart(request.headers.get('x-guest-id'), user.id)
      db.save()
      return HttpResponse.json({ token, expiresAt, user: publicUser(user) })
    }),
  ),

  http.post(
    '/api/session/signup',
    scenarioed(async ({ request }) => {
      const body = await parseBody(request, signupBodySchema)
      if (!body.ok) return body.response
      if (db.state.users.some((u) => u.email.toLowerCase() === body.data.email.toLowerCase())) {
        return fail(409, 'EMAIL_TAKEN', 'Este e-mail já está cadastrado.', {
          fields: { email: 'Este e-mail já está cadastrado. Tente entrar.' },
        })
      }
      const id = `user-${randomHex(5)}`
      const user: UserRecord = {
        id,
        name: body.data.name,
        username: uniqueUsername(body.data.name),
        email: body.data.email,
        ensName: null,
        referralCode: null,
        passwordHash: await hashPassword(id, body.data.password),
        avatar: null,
        createdAt: new Date().toISOString(),
      }
      db.state.users.push(user)
      db.state.favorites[user.id] = []
      db.state.wallets[user.id] = []
      const token = `tok_${randomHex(16)}`
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
      db.state.sessions[token] = { userId: user.id, expiresAt }
      mergeGuestCart(request.headers.get('x-guest-id'), user.id)
      db.save()
      return HttpResponse.json({ token, expiresAt, user: publicUser(user) }, { status: 201 })
    }),
  ),

  http.get(
    '/api/session',
    scenarioed(({ request }) => {
      const auth = authenticate(request)
      if ('response' in auth) return auth.response
      return HttpResponse.json({
        user: publicUser(auth.user),
        expiresAt: db.state.sessions[auth.token].expiresAt,
      })
    }),
  ),

  http.post(
    '/api/session/logout',
    scenarioed(({ request }) => {
      const token = bearer(request)
      if (token) delete db.state.sessions[token]
      db.save()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  /* Perfil */
  http.patch(
    '/api/profile',
    scenarioed(async ({ request }) => {
      const auth = authenticate(request)
      if ('response' in auth) return auth.response
      const body = await parseBody(request, profileBodySchema)
      if (!body.ok) return body.response
      const clash = db.state.users.some(
        (u) => u.id !== auth.user.id && u.email.toLowerCase() === body.data.email.toLowerCase(),
      )
      if (clash) {
        return fail(409, 'EMAIL_TAKEN', 'Este e-mail já está em uso.', {
          fields: { email: 'Este e-mail já está em uso por outra conta.' },
        })
      }
      const nextUsername = body.data.username ?? auth.user.username
      const usernameTaken = db.state.users.some(
        (u) => u.id !== auth.user.id && u.username.toLowerCase() === nextUsername.toLowerCase(),
      )
      if (usernameTaken) {
        return fail(409, 'VALIDATION_ERROR', 'Este nome de usuário já está em uso.', {
          fields: { username: 'Este nome de usuário já está em uso.' },
        })
      }
      auth.user.name = body.data.name
      auth.user.username = nextUsername
      auth.user.email = body.data.email
      if (body.data.ensName !== undefined) auth.user.ensName = body.data.ensName || null
      if (body.data.referralCode !== undefined) auth.user.referralCode = body.data.referralCode || null
      if (body.data.avatar !== undefined) auth.user.avatar = body.data.avatar
      db.save()
      return HttpResponse.json(publicUser(auth.user))
    }),
  ),

  http.put(
    '/api/profile/password',
    scenarioed(async ({ request }) => {
      const auth = authenticate(request)
      if ('response' in auth) return auth.response
      const body = await parseBody(request, passwordBodySchema)
      if (!body.ok) return body.response
      if (auth.user.passwordHash !== (await hashPassword(auth.user.id, body.data.currentPassword))) {
        return fail(422, 'VALIDATION_ERROR', 'Senha atual incorreta.', {
          fields: { currentPassword: 'Senha atual incorreta.' },
        })
      }
      if (body.data.newPassword === body.data.currentPassword) {
        return fail(422, 'VALIDATION_ERROR', 'A nova senha deve ser diferente da atual.', {
          fields: { newPassword: 'A nova senha deve ser diferente da atual.' },
        })
      }
      auth.user.passwordHash = await hashPassword(auth.user.id, body.data.newPassword)
      db.save()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  /* Favoritos */
  http.get(
    '/api/favorites',
    scenarioed(({ request }) => {
      const auth = authenticate(request)
      if ('response' in auth) return auth.response
      const ids = db.state.favorites[auth.user.id] ?? []
      const items = ids.flatMap((id) => {
        const n = liveNft(id)
        return n ? [toSummary(n, auth.user.id)] : []
      })
      return HttpResponse.json(items)
    }),
  ),

  http.post(
    '/api/favorites',
    scenarioed(async ({ request }) => {
      const auth = authenticate(request)
      if ('response' in auth) return auth.response
      const { nftId } = (await request.json()) as { nftId?: string }
      if (!nftId || !liveNft(nftId)) return fail(404, 'NOT_FOUND', 'NFT não encontrado.')
      const list = (db.state.favorites[auth.user.id] ??= [])
      if (!list.includes(nftId)) list.push(nftId)
      db.save()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.delete(
    '/api/favorites/:id',
    scenarioed(({ request, params }) => {
      const auth = authenticate(request)
      if ('response' in auth) return auth.response
      const list = db.state.favorites[auth.user.id] ?? []
      db.state.favorites[auth.user.id] = list.filter((id) => id !== params.id)
      db.save()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  /* Carrinho */
  http.get(
    '/api/cart',
    scenarioed(({ request }) => {
      const auth = optionalAuth(request)
      if ('response' in auth) return auth.response
      return HttpResponse.json(serializeCart(ownerKey(request, auth.user)))
    }),
  ),

  http.post(
    '/api/cart/items',
    scenarioed(async ({ request }) => {
      const auth = optionalAuth(request)
      if ('response' in auth) return auth.response
      const body = await parseBody(request, cartItemBodySchema)
      if (!body.ok) return body.response
      const n = liveNft(body.data.nftId)
      if (!n) return fail(404, 'NOT_FOUND', 'NFT não encontrado.')
      if (n.available === 0) return fail(409, 'OUT_OF_STOCK', 'Esta edição está esgotada.')
      const key = ownerKey(request, auth.user)
      const cart = (db.state.carts[key] ??= { version: 0, items: [], updatedAt: '' })
      const existing = cart.items.find((i) => i.nftId === n.id)
      const next = (existing?.quantity ?? 0) + body.data.quantity
      const max = maxQuantityFor(n.available)
      if (next > max) {
        return fail(409, 'QUANTITY_LIMIT', `Você pode ter no máximo ${max} unidade(s) deste NFT no carrinho.`, {
          details: { max },
        })
      }
      if (existing) existing.quantity = next
      else cart.items.push({ nftId: n.id, quantity: body.data.quantity })
      touchCart(key)
      return HttpResponse.json(serializeCart(key), { status: 201 })
    }),
  ),

  http.patch(
    '/api/cart/items/:id',
    scenarioed(async ({ request, params }) => {
      const auth = optionalAuth(request)
      if ('response' in auth) return auth.response
      const { quantity } = (await request.json()) as { quantity?: number }
      if (!Number.isInteger(quantity) || (quantity as number) < 1) {
        return fail(422, 'VALIDATION_ERROR', 'Quantidade inválida.', { fields: { quantity: 'Informe um número inteiro maior que zero.' } })
      }
      const key = ownerKey(request, auth.user)
      const cart = db.state.carts[key]
      const item = cart?.items.find((i) => i.nftId === params.id)
      if (!cart || !item) return fail(404, 'NOT_FOUND', 'Item não está no carrinho.')
      const n = liveNft(item.nftId)
      if (!n) return fail(404, 'NOT_FOUND', 'NFT não encontrado.')
      const max = maxQuantityFor(n.available)
      if ((quantity as number) > max) {
        return fail(409, max === 0 ? 'OUT_OF_STOCK' : 'QUANTITY_LIMIT', max === 0 ? 'Esta edição está esgotada.' : `Máximo de ${max} unidade(s) disponível.`, { details: { max } })
      }
      item.quantity = quantity as number
      touchCart(key)
      return HttpResponse.json(serializeCart(key))
    }),
  ),

  http.delete(
    '/api/cart/items/:id',
    scenarioed(({ request, params }) => {
      const auth = optionalAuth(request)
      if ('response' in auth) return auth.response
      const key = ownerKey(request, auth.user)
      const cart = db.state.carts[key]
      if (cart) {
        cart.items = cart.items.filter((i) => i.nftId !== params.id)
        touchCart(key)
      }
      return HttpResponse.json(serializeCart(key))
    }),
  ),

  /* Cotação */
  http.post(
    '/api/quote',
    scenarioed(async ({ request }) => {
      const auth = optionalAuth(request)
      if ('response' in auth) return auth.response
      const body = await parseBody(request, quoteBodySchema)
      if (!body.ok) return body.response
      return HttpResponse.json(computeQuote(ownerKey(request, auth.user), body.data.couponCode, body.data.network))
    }),
  ),

  /* Pedidos */
  http.post(
    '/api/orders',
    scenarioed(async ({ request }) => {
      const auth = authenticate(request)
      if ('response' in auth) return auth.response
      const idemKey = request.headers.get('idempotency-key')
      if (!idemKey) {
        return fail(422, 'VALIDATION_ERROR', 'Cabeçalho Idempotency-Key é obrigatório.')
      }
      const body = await parseBody(request, createOrderBodySchema)
      if (!body.ok) return body.response
      const fingerprint = JSON.stringify({
        w: body.data.walletId,
        n: body.data.network,
        c: (body.data.couponCode ?? '').toUpperCase(),
        t: body.data.expectedTotal,
      })

      // Idempotência: mesma chave + mesmo conteúdo = mesmo pedido; conteúdo diferente = conflito.
      const prior = Object.values(db.state.orders).find((o) => o.userId === auth.user.id && o.idemKey === idemKey)
      if (prior) {
        if (prior.fingerprint !== fingerprint) {
          return fail(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
        }
        return HttpResponse.json(serializeOrder(prior), { status: 200 })
      }

      const wallet = (db.state.wallets[auth.user.id] ?? []).find((w) => w.id === body.data.walletId)
      if (!wallet) {
        return fail(422, 'VALIDATION_ERROR', 'Carteira não encontrada.', { fields: { walletId: 'Selecione uma carteira válida.' } })
      }
      const key = `user:${auth.user.id}`
      const cart = db.state.carts[key]
      if (!cart || cart.items.length === 0) return fail(409, 'EMPTY_CART', 'Seu carrinho está vazio.')
      // Cenário "carteira desconectada": a conexão cai antes da confirmação (uma vez).
      if (scenarioStore.get().wallet === 'disconnected') {
        db.state.connections[auth.user.id] = null
        scenarioStore.set({ wallet: 'ok' })
        db.save()
      }
      if (db.state.connections[auth.user.id] !== wallet.id) {
        return fail(409, 'WALLET_DISCONNECTED', 'A carteira está desconectada. Conecte novamente para continuar.')
      }

      // Cenários de falha no momento da compra (one-shot).
      const first = cart.items[0]
      if (scenarioStore.consume('priceChangeOnCheckout')) {
        const n = liveNft(first.nftId)
        if (n) {
          const evt = patchNft(n.id, { price: scalePrice(n.price, 11_000) })
          if (evt) emitNftUpdated(evt)
        }
      }
      if (scenarioStore.consume('soldOutOnCheckout')) {
        const evt = patchNft(first.nftId, { available: 0 })
        if (evt) emitNftUpdated(evt)
      }

      const quote = computeQuote(key, body.data.couponCode, body.data.network)
      if (quote.hasIssues) {
        return fail(409, 'OUT_OF_STOCK', 'Alguns itens não estão mais disponíveis na quantidade escolhida.', {
          details: { quote },
        })
      }
      if (!eqEth(quote.total, body.data.expectedTotal)) {
        return fail(409, 'PRICE_CHANGED', 'O valor do pedido mudou. Revise o total antes de confirmar.', {
          details: { quote },
        })
      }

      const now = new Date().toISOString()
      const outcome = scenarioStore.get().payment
      const order: OrderRecord = {
        id: `ord_${randomHex(6)}`,
        userId: auth.user.id,
        idemKey,
        fingerprint,
        status: 'pending',
        version: 1,
        createdAt: now,
        updatedAt: now,
        settleAt: Date.now() + 2500,
        outcome,
        items: quote.items.map((i) => {
          const n = liveNft(i.nftId) as LiveNft
          return {
            nftId: i.nftId,
            tokenId: n.tokenId,
            name: i.name,
            image: n.image,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            lineTotal: i.lineTotal,
          }
        }),
        subtotal: quote.subtotal,
        discount: quote.discount,
        networkFee: quote.networkFee,
        total: quote.total,
        network: body.data.network,
        couponCode: quote.coupon?.status === 'applied' ? quote.coupon.code : null,
        wallet: { label: wallet.label, address: wallet.address, provider: body.data.provider ?? wallet.provider },
        collector: body.data.collector
          ? Object.fromEntries(Object.entries(body.data.collector).filter((entry): entry is [string, string] => Boolean(entry[1])))
          : null,
        txHash: null,
        failureReason: null,
      }
      db.state.orders[order.id] = order

      // Reserva de estoque (e notificação em tempo real).
      for (const it of order.items) {
        const n = liveNft(it.nftId)
        if (!n) continue
        const evt = patchNft(it.nftId, { available: Math.max(0, n.available - it.quantity) })
        if (evt) emitNftUpdated(evt)
      }
      db.save()
      scheduleSettle(order)

      // Cenário de timeout: o pedido foi criado, mas a resposta chega depois do limite do cliente.
      if (scenarioStore.consume('orderTimeout')) await sleepMs(12_000)

      return HttpResponse.json(serializeOrder(order), { status: 201 })
    }),
  ),

  http.get(
    '/api/orders/:id',
    scenarioed(({ request, params }) => {
      const auth = authenticate(request)
      if ('response' in auth) return auth.response
      const order = db.state.orders[String(params.id)]
      if (!order || order.userId !== auth.user.id) return fail(404, 'NOT_FOUND', 'Pedido não encontrado.')
      if (order.status === 'pending' && Date.now() >= order.settleAt) settleOrder(order)
      return HttpResponse.json(serializeOrder(order))
    }),
  ),

  /* Carteiras */
  http.get(
    '/api/wallets',
    scenarioed(({ request }) => {
      const auth = authenticate(request)
      if ('response' in auth) return auth.response
      return HttpResponse.json((db.state.wallets[auth.user.id] ?? []).map((w) => serializeWallet(auth.user.id, w)))
    }),
  ),

  http.post(
    '/api/wallets',
    scenarioed(async ({ request }) => {
      const auth = authenticate(request)
      if ('response' in auth) return auth.response
      const body = await parseBody(request, walletBodySchema)
      if (!body.ok) return body.response
      const list = (db.state.wallets[auth.user.id] ??= [])
      if (list.some((w) => w.address.toLowerCase() === body.data.address.toLowerCase())) {
        return fail(409, 'VALIDATION_ERROR', 'Esta carteira já está cadastrada.', {
          fields: { address: 'Esta carteira já está cadastrada.' },
        })
      }
      const makePrimary = body.data.isPrimary || list.length === 0
      if (makePrimary) for (const w of list) w.isPrimary = false
      const wallet: WalletRecord = {
        id: `wal-${randomHex(4)}`,
        label: body.data.label,
        address: body.data.address,
        network: body.data.network,
        provider: body.data.provider ?? 'metamask',
        ens: body.data.ens || null,
        isPrimary: makePrimary,
        createdAt: new Date().toISOString(),
      }
      list.push(wallet)
      db.save()
      return HttpResponse.json(serializeWallet(auth.user.id, wallet), { status: 201 })
    }),
  ),

  http.patch(
    '/api/wallets/:id',
    scenarioed(async ({ request, params }) => {
      const auth = authenticate(request)
      if ('response' in auth) return auth.response
      const body = await parseBody(request, walletBodySchema.partial())
      if (!body.ok) return body.response
      const list = db.state.wallets[auth.user.id] ?? []
      const wallet = list.find((w) => w.id === params.id)
      if (!wallet) return fail(404, 'NOT_FOUND', 'Carteira não encontrada.')
      if (body.data.address && list.some((w) => w.id !== wallet.id && w.address.toLowerCase() === body.data.address?.toLowerCase())) {
        return fail(409, 'VALIDATION_ERROR', 'Esta carteira já está cadastrada.', {
          fields: { address: 'Esta carteira já está cadastrada.' },
        })
      }
      if (body.data.label !== undefined) wallet.label = body.data.label
      if (body.data.address !== undefined) wallet.address = body.data.address
      if (body.data.network !== undefined) wallet.network = body.data.network
      if (body.data.provider !== undefined) wallet.provider = body.data.provider
      if (body.data.ens !== undefined) wallet.ens = body.data.ens || null
      if (body.data.isPrimary) {
        for (const w of list) w.isPrimary = w.id === wallet.id
      }
      db.save()
      return HttpResponse.json(serializeWallet(auth.user.id, wallet))
    }),
  ),

  http.post(
    '/api/wallets/:id/connect',
    scenarioed(async ({ request, params }) => {
      const auth = authenticate(request)
      if ('response' in auth) return auth.response
      const wallet = (db.state.wallets[auth.user.id] ?? []).find((w) => w.id === params.id)
      if (!wallet) return fail(404, 'NOT_FOUND', 'Carteira não encontrada.')
      if (scenarioStore.get().wallet === 'refused') {
        // A recusa vale uma vez: a próxima tentativa deve poder conectar.
        scenarioStore.set({ wallet: 'ok' })
        return fail(403, 'FORBIDDEN', 'A conexão foi recusada na carteira.')
      }
      db.state.connections[auth.user.id] = wallet.id
      db.save()
      return HttpResponse.json(serializeWallet(auth.user.id, wallet))
    }),
  ),

  http.post(
    '/api/wallets/:id/disconnect',
    scenarioed(({ request, params }) => {
      const auth = authenticate(request)
      if ('response' in auth) return auth.response
      const wallet = (db.state.wallets[auth.user.id] ?? []).find((w) => w.id === params.id)
      if (!wallet) return fail(404, 'NOT_FOUND', 'Carteira não encontrada.')
      if (db.state.connections[auth.user.id] === wallet.id) db.state.connections[auth.user.id] = null
      db.save()
      return HttpResponse.json(serializeWallet(auth.user.id, wallet))
    }),
  ),

  ...realtimeHandlers,
]

function publicUser(u: UserRecord) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    ensName: u.ensName,
    referralCode: u.referralCode,
    avatar: u.avatar,
    createdAt: u.createdAt,
  }
}

function uniqueUsername(name: string) {
  const base =
    norm(name)
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 24) || 'colecionador'
  const root = base.length >= 3 ? base : `${base}.nft`
  let candidate = root
  let n = 1
  while (db.state.users.some((u) => u.username === candidate)) candidate = `${root}${++n}`
  return candidate
}
