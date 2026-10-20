import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  type RouterHistory,
  redirect,
} from '@tanstack/react-router'
import { sessionStore } from '@/auth/session-store'
import { ErrorState, NotFoundState } from '@/components/common/states'
import { AppShell } from '@/components/layout/app-shell'
import { HomePage } from '@/pages/home'
import { safeRedirect } from '@/lib/format'
import { authSearchSchema, homeSearchSchema, parseSearch, profileSearchSchema, stringifySearch } from '@/search-schemas'

/** Rotas privadas: sem sessão válida, vai ao login e volta ao mesmo caminho (com busca) depois. */
function requireAuth(reason?: 'checkout') {
  return ({ location }: { location: { href: string } }) => {
    const session = sessionStore.getSnapshot()
    if (!session || sessionStore.isExpired()) {
      if (session) sessionStore.end('expired')
      throw redirect({ to: '/login', search: { redirect: location.href, reason } })
    }
  }
}

/** Login/cadastro: usuário já autenticado é enviado para o destino original ou o início. */
function guestOnly({ search }: { search: { redirect?: string } }) {
  if (sessionStore.getSnapshot() && !sessionStore.isExpired()) {
    throw redirect({ to: safeRedirect(search.redirect) })
  }
}

/** Cada instância tem seu próprio estado: permite testes isolados com histórico em memória. */
export function createAppRouter(history?: RouterHistory) {
  const rootRoute = createRootRoute({
    component: AppShell,
    notFoundComponent: () => <NotFoundState />,
    errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} title="Algo deu errado nesta página" />,
  })

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    validateSearch: (raw) => homeSearchSchema.parse(raw),
    component: HomePage,
  })

  const nftRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/nft/$nftId',
    component: lazyRouteComponent(() => import('@/pages/nft-detail'), 'NftDetailPage'),
  })

  const cartRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cart', component: lazyRouteComponent(() => import('@/pages/cart'), 'CartPage') })

  const checkoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/checkout',
    beforeLoad: requireAuth('checkout'),
    component: lazyRouteComponent(() => import('@/pages/checkout'), 'CheckoutPage'),
  })

  const orderRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/orders/$orderId',
    beforeLoad: requireAuth(),
    component: lazyRouteComponent(() => import('@/pages/order'), 'OrderPage'),
  })

  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    validateSearch: (raw) => authSearchSchema.parse(raw),
    beforeLoad: guestOnly,
    component: lazyRouteComponent(() => import('@/pages/login'), 'LoginPage'),
  })

  const signupRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/signup',
    validateSearch: (raw) => authSearchSchema.parse(raw),
    beforeLoad: guestOnly,
    component: lazyRouteComponent(() => import('@/pages/signup'), 'SignupPage'),
  })

  const profileRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/profile',
    validateSearch: (raw) => profileSearchSchema.parse(raw),
    beforeLoad: requireAuth(),
    component: lazyRouteComponent(() => import('@/pages/profile'), 'ProfilePage'),
  })

  const walletsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/wallets',
    beforeLoad: requireAuth(),
    component: lazyRouteComponent(() => import('@/pages/wallets'), 'WalletsPage'),
  })

  const routeTree = rootRoute.addChildren([
    indexRoute,
    nftRoute,
    cartRoute,
    checkoutRoute,
    orderRoute,
    loginRoute,
    signupRoute,
    profileRoute,
    walletsRoute,
  ])

  return createRouter({
    routeTree,
    history,
    parseSearch,
    stringifySearch,
    defaultPreload: 'intent',
    defaultPendingMs: 200,
    defaultPendingComponent: () => <p role="status" className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>,
    scrollRestoration: true,
    defaultNotFoundComponent: () => <NotFoundState />,
  })
}

export const router = createAppRouter()

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
