import { Outlet, useRouterState } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { SessionEffects } from '@/app/session-effects'
import { Toaster } from '@/components/ui/toaster'
import { useIsDesktop } from '@/hooks/use-media'
import { cn } from '@/lib/utils'
import { Footer, LiveIndicator } from './footer'
import { Header } from './header'
import { MobileTabBar } from './mobile-nav'

// O painel e os mocks só entram no bundle quando VITE_ENABLE_MOCKS=true.
const MockPanel = import.meta.env.VITE_ENABLE_MOCKS === 'true' ? lazy(() => import('@/components/mock/mock-panel')) : null

/** No mobile, a tab bar aparece só nas telas que a têm no layout (início e conta). */
const tabBarPaths = ['/', '/profile', '/wallets']
const authPaths = ['/login', '/signup']

export function AppShell() {
  const isDesktop = useIsDesktop()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const showTabBar = !isDesktop && tabBarPaths.includes(pathname)
  const isAuth = authPaths.includes(pathname)
  const isDetail = pathname.startsWith('/nft/')

  return (
    <div className="relative flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-[6px] bg-primary px-4 py-2 font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>
      <SessionEffects />
      <div className="mx-auto flex w-full max-w-[1248px] flex-1 flex-col px-6">
        {isDesktop ? <Header /> : !isAuth && !isDetail ? <LiveIndicator className="absolute right-6 top-3" /> : null}
        <main
          id="main"
          tabIndex={-1}
          className={cn('flex-1 outline-none', isDesktop ? 'pt-8' : isDetail ? 'pt-0' : 'pt-10', showTabBar && 'pb-[150px]')}
        >
          <Outlet />
        </main>
        {isDesktop ? (
          <div className="mb-6 mt-24">
            <Footer />
          </div>
        ) : null}
      </div>
      {showTabBar ? <MobileTabBar /> : null}
      <Toaster />
      {MockPanel ? (
        <Suspense fallback={null}>
          <MockPanel />
        </Suspense>
      ) : null}
    </div>
  )
}
