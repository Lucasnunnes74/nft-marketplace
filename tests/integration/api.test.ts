import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/api/errors'
import * as api from '@/api/resources'
import { sessionStore } from '@/auth/session-store'
import { db } from '@/mocks/db'
import { handlers } from '@/mocks/handlers'
import { scenarioStore } from '@/mocks/scenario'

/**
 * Integração: cliente real (Axios + zod) → MSW → API simulada.
 * Cobre contratos, regras de negócio e cenários de falha exigidos.
 */
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

beforeEach(() => {
  localStorage.clear()
  db.reset()
  scenarioStore.reset()
  sessionStore.end('logout')
})

async function loginDemo() {
  const res = await api.login({ email: 'demo@nft.test', password: 'Demo@1234' })
  sessionStore.start({ token: res.token, expiresAt: res.expiresAt, userId: res.user.id })
  return res
}

async function expectApiError(promise: Promise<unknown>) {
  try {
    await promise
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError)
    return e as ApiError
  }
  throw new Error('Era esperado um ApiError')
}

describe('catálogo', () => {
  it('pagina, filtra, ordena e busca ignorando acentos', async () => {
    const all = await api.listNfts({ pageSize: 12 })
    expect(all.items).toHaveLength(12)
    expect(all.total).toBeGreaterThan(12)
    expect(all.totalPages).toBe(Math.ceil(all.total / 12))

    const page2 = await api.listNfts({ page: 2, pageSize: 12 })
    expect(page2.page).toBe(2)
    expect(page2.items.some((i) => all.items.some((j) => j.id === i.id))).toBe(false)

    const art = await api.listNfts({ category: 'art' })
    expect(art.items.length).toBeGreaterThan(0)
    expect(art.items.every((i) => i.category === 'art')).toBe(true)

    const asc = await api.listNfts({ sort: 'price_asc', pageSize: 48 })
    const prices = asc.items.map((i) => Number(i.price))
    expect(prices).toEqual([...prices].sort((a, b) => a - b))

    // "Ônix" é encontrado digitando "onix"
    const search = await api.listNfts({ q: 'onix' })
    expect(search.items.map((i) => i.name.toLowerCase())).toEqual(expect.arrayContaining([expect.stringContaining('ônix')]))
  })

  it('combina filtros (categoria + preço + só disponíveis)', async () => {
    const res = await api.listNfts({ category: 'collectibles', maxPrice: '1', availableOnly: true, pageSize: 48 })
    for (const i of res.items) {
      expect(i.category).toBe('collectibles')
      expect(Number(i.price)).toBeLessThanOrEqual(1)
      expect(i.available).toBeGreaterThan(0)
    }
  })

  it('retorna lista vazia (não erro) para busca sem resultados', async () => {
    const res = await api.listNfts({ q: 'zzzz-nada' })
    expect(res.items).toEqual([])
    expect(res.total).toBe(0)
  })

  it('rejeita parâmetros inválidos com 422', async () => {
    const err = await expectApiError(api.listNfts({ page: 0 }))
    expect(err.status).toBe(422)
    expect(err.code).toBe('VALIDATION_ERROR')
  })

  it('NFT inexistente responde 404', async () => {
    const err = await expectApiError(api.getNft('nft-999'))
    expect(err.code).toBe('NOT_FOUND')
  })
})

describe('sessão e cadastro', () => {
  it('login inválido, cadastro duplicado e validação de formulário', async () => {
    expect((await expectApiError(api.login({ email: 'demo@nft.test', password: 'errada' }))).code).toBe('UNAUTHENTICATED')

    const dup = await expectApiError(api.signup({ name: 'Outra Pessoa', email: 'demo@nft.test', password: 'Senha123' }))
    expect(dup.code).toBe('EMAIL_TAKEN')
    expect(dup.fields.email).toBeTruthy()

    const invalid = await expectApiError(api.signup({ name: 'X', email: 'nope', password: '123' }))
    expect(invalid.status).toBe(422)
    expect(Object.keys(invalid.fields)).toEqual(expect.arrayContaining(['name', 'email', 'password']))
  })

  it('sessão expirada devolve 401 SESSION_EXPIRED e encerra a sessão local', async () => {
    await loginDemo()
    expect((await api.getSession()).user.email).toBe('demo@nft.test')
    db.state.sessions = {} // o servidor "esquece" o token
    const err = await expectApiError(api.getSession())
    expect(err.code).toBe('SESSION_EXPIRED')
    expect(sessionStore.getSnapshot()).toBeNull()
  })

  it('recursos privados exigem autenticação', async () => {
    expect((await expectApiError(api.listWallets())).code).toBe('UNAUTHENTICATED')
    expect((await expectApiError(api.listFavorites())).code).toBe('UNAUTHENTICATED')
  })
})

describe('carrinho e cotação', () => {
  it('respeita estoque e limite por pedido', async () => {
    // nft-004 tem apenas 2 unidades; nft-011 está esgotado
    await api.addCartItem({ nftId: 'nft-004', quantity: 2 })
    const over = await expectApiError(api.addCartItem({ nftId: 'nft-004', quantity: 1 }))
    expect(over.code).toBe('QUANTITY_LIMIT')
    const soldOut = await expectApiError(api.addCartItem({ nftId: 'nft-011', quantity: 1 }))
    expect(soldOut.code).toBe('OUT_OF_STOCK')
  })

  it('visitante mantém o carrinho ao autenticar (merge)', async () => {
    await api.addCartItem({ nftId: 'nft-001', quantity: 2 })
    expect((await api.getCart()).items).toHaveLength(1)
    await loginDemo() // o login envia o X-Guest-Id e o servidor mescla
    const cart = await api.getCart()
    expect(cart.items).toEqual([expect.objectContaining({ nftId: 'nft-001', quantity: 2 })])
  })

  it('cotação: subtotal, desconto, taxa e total em strings decimais exatas', async () => {
    await api.addCartItem({ nftId: 'nft-001', quantity: 2 })
    const base = await api.getQuote({})
    const withCoupon = await api.getQuote({ couponCode: 'welcome10', network: 'polygon' })
    expect(withCoupon.coupon?.status).toBe('applied')
    expect(withCoupon.discount).not.toBe('0')
    expect(withCoupon.networkFee).toBe('0.0002')
    expect(Number(withCoupon.total)).toBeLessThan(Number(base.subtotal))

    expect((await api.getQuote({ couponCode: 'EXPIRED20' })).coupon?.status).toBe('expired')
    expect((await api.getQuote({ couponCode: 'NAOEXISTE' })).coupon?.status).toBe('invalid')
  })
})

describe('pedidos', () => {
  async function prepareCheckout() {
    await loginDemo()
    await api.addCartItem({ nftId: 'nft-001', quantity: 1 })
    const wallets = await api.listWallets()
    const wallet = wallets[0]
    await api.connectWallet(wallet.id, 'ethereum')
    const quote = await api.getQuote({ network: 'ethereum' })
    return { wallet, quote }
  }

  it('é idempotente: mesma chave devolve o mesmo pedido; conteúdo diferente conflita', async () => {
    const { wallet, quote } = await prepareCheckout()
    const body = { walletId: wallet.id, network: 'ethereum' as const, expectedTotal: quote.total }
    const first = await api.createOrder(body, 'idem-1')
    const again = await api.createOrder(body, 'idem-1')
    expect(again.id).toBe(first.id)

    const conflict = await expectApiError(api.createOrder({ ...body, network: 'polygon' }, 'idem-1'))
    expect(conflict.code).toBe('IDEMPOTENCY_CONFLICT')
    expect(Object.keys(db.state.orders)).toHaveLength(1)
  })

  it('revalida preço: mudança durante a compra responde 409 PRICE_CHANGED com a nova cotação', async () => {
    const { wallet, quote } = await prepareCheckout()
    scenarioStore.set({ priceChangeOnCheckout: true })
    const err = await expectApiError(
      api.createOrder({ walletId: wallet.id, network: 'ethereum', expectedTotal: quote.total }, 'idem-price'),
    )
    expect(err.code).toBe('PRICE_CHANGED')
    const fresh = (err.details as { quote: { total: string } }).quote
    expect(fresh.total).not.toBe(quote.total)
    // Com o novo total confirmado pelo usuário, a compra passa (outra chave: conteúdo mudou).
    const order = await api.createOrder({ walletId: wallet.id, network: 'ethereum', expectedTotal: fresh.total }, 'idem-price-2')
    expect(order.status).toBe('pending')
  })

  it('item esgotado durante a compra responde 409 OUT_OF_STOCK', async () => {
    const { wallet, quote } = await prepareCheckout()
    scenarioStore.set({ soldOutOnCheckout: true })
    const err = await expectApiError(
      api.createOrder({ walletId: wallet.id, network: 'ethereum', expectedTotal: quote.total }, 'idem-stock'),
    )
    expect(err.code).toBe('OUT_OF_STOCK')
    expect((await api.getCart()).items).toHaveLength(1) // o carrinho é preservado em falhas
  })

  it('carteira desconectada bloqueia a compra até reconectar', async () => {
    const { wallet, quote } = await prepareCheckout()
    scenarioStore.set({ wallet: 'disconnected' })
    const err = await expectApiError(
      api.createOrder({ walletId: wallet.id, network: 'ethereum', expectedTotal: quote.total }, 'idem-wallet'),
    )
    expect(err.code).toBe('WALLET_DISCONNECTED')
    await api.connectWallet(wallet.id, 'ethereum')
    const order = await api.createOrder({ walletId: wallet.id, network: 'ethereum', expectedTotal: quote.total }, 'idem-wallet')
    expect(order.status).toBe('pending')
  })

  it('confirma o pedido: gera recibo e remove do carrinho só o que foi comprado', async () => {
    await loginDemo()
    await api.addCartItem({ nftId: 'nft-001', quantity: 2 })
    await api.addCartItem({ nftId: 'nft-002', quantity: 1 })
    const wallet = (await api.listWallets())[0]
    await api.connectWallet(wallet.id, 'ethereum')
    const quote = await api.getQuote({ network: 'ethereum' })
    const created = await api.createOrder({ walletId: wallet.id, network: 'ethereum', expectedTotal: quote.total }, 'idem-ok')
    expect(created.status).toBe('pending')
    expect(created.txHash).toBeNull()

    await new Promise((r) => setTimeout(r, 2700))
    const settled = await api.getOrder(created.id)
    expect(settled.status).toBe('confirmed')
    expect(settled.txHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(settled.total).toBe(quote.total)
    expect((await api.getCart()).items).toEqual([]) // tudo foi comprado
  })

  it('pagamento recusado devolve o estoque e mantém o carrinho', async () => {
    const { wallet, quote } = await prepareCheckout()
    const before = (await api.getNft('nft-001')).available
    scenarioStore.set({ payment: 'refused' })
    const created = await api.createOrder({ walletId: wallet.id, network: 'ethereum', expectedTotal: quote.total }, 'idem-refused')
    expect((await api.getNft('nft-001')).available).toBe(before - 1) // reservado

    await new Promise((r) => setTimeout(r, 2700))
    const settled = await api.getOrder(created.id)
    expect(settled.status).toBe('rejected')
    expect(settled.failureReason).toBeTruthy()
    expect((await api.getNft('nft-001')).available).toBe(before) // devolvido
    expect((await api.getCart()).items).toHaveLength(1)
  })

  it('pedido de outro usuário não é acessível (404)', async () => {
    const { wallet, quote } = await prepareCheckout()
    const order = await api.createOrder({ walletId: wallet.id, network: 'ethereum', expectedTotal: quote.total }, 'idem-own')
    sessionStore.end('logout')
    const ana = await api.login({ email: 'ana@nft.test', password: 'Demo@1234' })
    sessionStore.start({ token: ana.token, expiresAt: ana.expiresAt, userId: ana.user.id })
    expect((await expectApiError(api.getOrder(order.id))).code).toBe('NOT_FOUND')
  })
})

describe('falhas de rede e latência simuladas', () => {
  it('HTTP 503 e 500 viram erros transitórios normalizados', async () => {
    scenarioStore.set({ failure: '503' })
    const e503 = await expectApiError(api.listNfts({}))
    expect(e503.status).toBe(503)
    expect(e503.isTransient).toBe(true)

    scenarioStore.set({ failure: '500' })
    expect((await expectApiError(api.listNfts({}))).code).toBe('INTERNAL_ERROR')
  })

  it('queda de conexão vira NETWORK; recupera quando o cenário normaliza', async () => {
    scenarioStore.set({ failure: 'network' })
    const err = await expectApiError(api.listNfts({}))
    expect(err.code).toBe('NETWORK')
    scenarioStore.set({ failure: 'none' })
    expect((await api.listNfts({})).items.length).toBeGreaterThan(0)
  })
})

describe('perfil, senha, carteiras e favoritos', () => {
  it('atualiza perfil e valida troca de senha', async () => {
    await loginDemo()
    const updated = await api.updateProfile({ name: 'Lucas Atualizado', email: 'demo@nft.test' })
    expect(updated.name).toBe('Lucas Atualizado')

    const wrong = await expectApiError(api.changePassword({ currentPassword: 'errada', newPassword: 'NovaSenha1' }))
    expect(wrong.fields.currentPassword).toBeTruthy()
    await api.changePassword({ currentPassword: 'Demo@1234', newPassword: 'NovaSenha1' })
    sessionStore.end('logout')
    await api.login({ email: 'demo@nft.test', password: 'NovaSenha1' })
  })

  it('carteiras: valida endereço, evita duplicidade e troca a principal', async () => {
    await loginDemo()
    expect((await expectApiError(api.createWallet({ label: 'Ruim', address: '0x123', network: 'base' }))).status).toBe(422)

    const created = await api.createWallet({
      label: 'Terceira',
      address: '0x1111111111111111111111111111111111111111',
      network: 'base',
    })
    expect(created.isPrimary).toBe(false)
    const dup = await expectApiError(
      api.createWallet({ label: 'Dup', address: '0x1111111111111111111111111111111111111111', network: 'base' }),
    )
    expect(dup.fields.address).toBeTruthy()

    await api.updateWallet(created.id, { isPrimary: true })
    const list = await api.listWallets()
    expect(list.filter((w) => w.isPrimary)).toHaveLength(1)
    expect(list.find((w) => w.isPrimary)?.id).toBe(created.id)
  })

  it('favoritos persistem por usuário', async () => {
    await loginDemo()
    await api.addFavorite('nft-003')
    expect((await api.listFavorites()).map((n) => n.id)).toEqual(expect.arrayContaining(['nft-002', 'nft-003']))
    expect((await api.getNft('nft-003')).isFavorite).toBe(true)
    await api.removeFavorite('nft-003')
    expect((await api.getNft('nft-003')).isFavorite).toBe(false)
  })
})
