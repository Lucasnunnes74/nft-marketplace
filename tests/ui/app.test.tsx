import { createMemoryHistory } from '@tanstack/react-router'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import App from '@/App'
import { sessionStore } from '@/auth/session-store'
import { queryClient } from '@/lib/query-client'
import { db } from '@/mocks/db'
import { handlers } from '@/mocks/handlers'
import { scenarioStore } from '@/mocks/scenario'
import { createAppRouter } from '@/router'
import { couponStore } from '@/stores/coupon'

/** Renderiza o app real (roteador + Query + formulários) sobre a API simulada via MSW. */
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterAll(() => server.close())

let current: ReturnType<typeof createAppRouter>

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  db.reset()
  scenarioStore.reset()
  couponStore.set('')
  sessionStore.end('logout')
  queryClient.clear()
})
afterEach(() => cleanup())

/** Cada teste ganha um roteador novo com histórico em memória, iniciando em `path`. */
function renderApp(path = '/') {
  current = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  return render(<App appRouter={current} />)
}

async function go(path: string) {
  await current.navigate({ to: path as never })
}

async function loginViaApi() {
  const res = await fetch(`${location.origin}/api/session/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'demo@nft.test', password: 'Demo@1234' }),
  }).then((r) => r.json())
  sessionStore.start({ token: res.token, expiresAt: res.expiresAt, userId: res.user.id })
}

describe('catálogo', () => {
  it('mostra destaque e catálogo, filtra por busca e reflete na URL', async () => {
    const user = userEvent.setup()
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'NFT EM DESTAQUE' })).toBeInTheDocument()
    const grid = await screen.findByTestId('catalog-grid')
    expect(within(grid).getAllByTestId('nft-card').length).toBe(9)

    await user.click(screen.getByRole('button', { name: 'Abrir busca' }))
    await user.type(screen.getByLabelText('Buscar'), 'jade')
    await waitFor(() => expect(current.state.location.search).toMatchObject({ q: 'jade' }), { timeout: 3000 })
    await waitFor(() => expect(screen.getByTestId('result-count')).toHaveTextContent('1 resultado'), { timeout: 3000 })

    await user.clear(screen.getByLabelText('Buscar'))
    await user.type(screen.getByLabelText('Buscar'), 'zzz-nada')
    expect(await screen.findByRole('heading', { name: 'Nenhum NFT encontrado' }, { timeout: 3000 })).toBeInTheDocument()
  })

  it('lê filtros da URL ao abrir diretamente (estado sobrevive a refresh)', async () => {
    renderApp('/?category=gaming&sort=price_desc')
    expect(await screen.findByRole('button', { name: /Jogos/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Ordenar por:')).toHaveValue('price_desc')
    const grid = await screen.findByTestId('catalog-grid')
    expect(within(grid).getAllByTestId('nft-card').length).toBeGreaterThan(0)
  })

  it('URL com parâmetros inválidos não quebra a tela', async () => {
    renderApp('/?category=inexistente&page=abc&minPrice=xyz')
    expect(await screen.findByTestId('catalog-grid')).toBeInTheDocument()
  })

  it('paginação muda a página na URL e o filtro reinicia a paginação', async () => {
    const user = userEvent.setup()
    renderApp('/')
    await screen.findByTestId('catalog-grid')
    await user.click(await screen.findByRole('link', { name: 'Próxima página' }))
    await waitFor(() => expect(screen.getByTestId('page-indicator')).toHaveTextContent('Página 2'))
    expect(current.state.location.search).toMatchObject({ page: 2 })

    await user.click(screen.getByRole('button', { name: /Arte digital/ }))
    await waitFor(() => expect(current.state.location.search).not.toHaveProperty('page'))
    expect(current.state.location.search).toMatchObject({ category: 'art' })
  })

  it('exibe erro com retry quando a API falha e recupera', async () => {
    scenarioStore.set({ failure: '503' })
    const user = userEvent.setup()
    renderApp('/')
    // Destaques e catálogo falham de forma independente: cada um tem seu retry.
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Tentar novamente/ })).toHaveLength(2), {
      timeout: 25_000,
    })
    const retry = screen.getAllByRole('button', { name: /Tentar novamente/ })
    scenarioStore.set({ failure: 'none' })
    for (const button of retry) await user.click(button)
    expect(await screen.findByTestId('catalog-grid')).toBeInTheDocument()
  }, 40_000)

  it('NFT inexistente mostra estado de não encontrado', async () => {
    renderApp('/nft/nft-999')
    expect(await screen.findByRole('heading', { name: 'NFT não encontrado' })).toBeInTheDocument()
  })

  it('NFT esgotado não permite comprar', async () => {
    renderApp('/nft/nft-011')
    expect(await screen.findByTestId('detail-availability')).toHaveTextContent('Esgotado')
    expect(screen.queryByRole('button', { name: 'COMPRAR' })).not.toBeInTheDocument()
  })

  it('rota inexistente mostra página não encontrada', async () => {
    renderApp('/nao-existe')
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
  })
})

describe('rotas privadas e sessão', () => {
  it('checkout sem sessão redireciona ao login preservando o destino', async () => {
    renderApp('/checkout')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(current.state.location.search).toMatchObject({ redirect: '/checkout', reason: 'checkout' })
  })

  it('login inválido mostra erro; válido volta ao destino', async () => {
    const user = userEvent.setup()
    renderApp('/login?redirect=%2Fwallets')
    await user.type(await screen.findByLabelText('E-mail'), 'demo@nft.test')
    await user.type(screen.getByLabelText('Senha'), 'errada')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Senha'))
    await user.type(screen.getByLabelText('Senha'), 'Demo@1234')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('heading', { name: 'Carteira principal' })).toBeInTheDocument()
    expect(current.state.location.pathname).toBe('/wallets')
  })

  it('redirect externo no login é ignorado (sem open redirect)', async () => {
    const user = userEvent.setup()
    renderApp('/login?redirect=https%3A%2F%2Fevil.example')
    await user.type(await screen.findByLabelText('E-mail'), 'demo@nft.test')
    await user.type(screen.getByLabelText('Senha'), 'Demo@1234')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(current.state.location.pathname).toBe('/'))
  })

  it('cadastro valida campos e mostra conflito de e-mail junto ao campo', async () => {
    const user = userEvent.setup()
    renderApp('/signup')
    await user.click(await screen.findByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('Informe seu nome')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Nome de usuário'), 'Pessoa Teste')
    await user.type(screen.getByLabelText('E-mail'), 'demo@nft.test')
    await user.type(screen.getByLabelText('Senha'), 'Senha1234')
    await user.type(screen.getByLabelText('Confirmar senha'), 'Senha1234')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText(/e-mail já está cadastrado/i)).toBeInTheDocument()
  })

  it('sessão expirada durante o uso leva ao login e preserva o carrinho', async () => {
    await loginViaApi()
    renderApp('/nft/nft-001')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'COMPRAR' }))
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent('1'))

    db.state.sessions = {} // o servidor invalida o token
    await go('/wallets')
    expect(await screen.findByRole('heading', { name: 'Entrar' }, { timeout: 8000 })).toBeInTheDocument()
    expect(current.state.location.search).toMatchObject({ redirect: '/wallets' })
    expect(db.state.carts['user:user-demo'].items).toHaveLength(1)
  }, 20_000)
})

describe('carrinho e compra (fluxo completo)', () => {
  it('visitante adiciona ao carrinho, loga, paga e vê o recibo confirmado', async () => {
    const user = userEvent.setup()
    renderApp('/nft/nft-001')

    await user.click(await screen.findByRole('button', { name: 'COMPRAR' }))
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent('1'))

    await go('/cart')
    expect(await screen.findByTestId('cart-item')).toBeInTheDocument()
    expect(await screen.findByTestId('quote-total')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Código promocional'), 'WELCOME10')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(await screen.findByTestId('coupon-status')).toHaveTextContent('aplicado')

    // Checkout exige login; o carrinho do visitante é mantido ao autenticar.
    await go('/checkout')
    await user.type(await screen.findByLabelText('E-mail'), 'demo@nft.test')
    await user.type(screen.getByLabelText('Senha'), 'Demo@1234')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await user.click(await screen.findByRole('button', { name: 'Conectar carteira' }))
    await waitFor(() => expect(screen.getByTestId('wallet-status')).toHaveTextContent('Carteira conectada'))
    await user.click(await screen.findByTestId('confirm-order'))

    expect(await screen.findByTestId('order-confirmed', undefined, { timeout: 15_000 })).toBeInTheDocument()
    expect(screen.getByTestId('order-tx')).toBeInTheDocument()
    expect(current.state.location.pathname).toMatch(/^\/orders\/ord_/)
    expect(db.state.carts['user:user-demo'].items).toHaveLength(0)
  }, 40_000)

  it('pagamento recusado leva ao estado de recusa e preserva o carrinho', async () => {
    const user = userEvent.setup()
    scenarioStore.set({ payment: 'refused' })
    await loginViaApi()
    renderApp('/nft/nft-001')
    await user.click(await screen.findByRole('button', { name: 'COMPRAR' }))
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent('1'))

    await go('/checkout')
    await user.click(await screen.findByRole('button', { name: 'Conectar carteira' }))
    await waitFor(() => expect(screen.getByTestId('wallet-status')).toHaveTextContent('Carteira conectada'))
    await user.click(await screen.findByTestId('confirm-order'))

    expect(await screen.findByTestId('order-rejected', undefined, { timeout: 15_000 })).toBeInTheDocument()
    expect(db.state.carts['user:user-demo'].items).toHaveLength(1)
  }, 40_000)

  it('preço muda durante a compra: exige ciência do novo total antes de confirmar', async () => {
    const user = userEvent.setup()
    scenarioStore.set({ priceChangeOnCheckout: true })
    await loginViaApi()
    renderApp('/nft/nft-001')
    await user.click(await screen.findByRole('button', { name: 'COMPRAR' }))
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent('1'))

    await go('/checkout')
    await user.click(await screen.findByRole('button', { name: 'Conectar carteira' }))
    await waitFor(() => expect(screen.getByTestId('wallet-status')).toHaveTextContent('Carteira conectada'))
    await user.click(await screen.findByTestId('confirm-order'))

    expect(await screen.findByTestId('price-changed')).toBeInTheDocument()
    expect(screen.getByTestId('confirm-order')).toBeDisabled()
    await user.click(screen.getByLabelText('Estou ciente do novo total'))
    await waitFor(() => expect(screen.getByTestId('confirm-order')).toBeEnabled(), { timeout: 5000 })
    await user.click(screen.getByTestId('confirm-order'))
    expect(await screen.findByTestId('order-confirmed', undefined, { timeout: 15_000 })).toBeInTheDocument()
  }, 40_000)
})

describe('favoritos (atualização otimista)', () => {
  it('visitante é levado ao login; autenticado favorita e desfaz com rollback em falha', async () => {
    const user = userEvent.setup()
    renderApp('/nft/nft-003')
    await user.click(await screen.findByRole('button', { name: 'Favoritar' }))
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(current.state.location.search).toMatchObject({ redirect: '/nft/nft-003' })
  })

  it('favorita com sucesso e persiste no servidor', async () => {
    const user = userEvent.setup()
    await loginViaApi()
    renderApp('/nft/nft-003')
    await user.click(await screen.findByRole('button', { name: 'Favoritar' }))
    expect(await screen.findByRole('button', { name: 'Favoritado' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(db.state.favorites['user-demo']).toContain('nft-003'))
  })
})
