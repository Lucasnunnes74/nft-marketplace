import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import type * as React from 'react'
import { FigmaIcon } from '@/components/ui/figma-icon'
import { cn } from '@/lib/utils'
import { useCartCount } from './header'

/** Tab bar inferior do layout mobile (fundo com recorte para o botão central). */
export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const search = useRouterState({ select: (s) => s.location.search as { section?: string } })
  const count = useCartCount()
  const favorites = pathname === '/profile' && search.section === 'interesse'
  const tab = favorites
    ? 'favorites'
    : pathname === '/cart' || pathname === '/checkout'
      ? 'cart'
      : pathname === '/profile' || pathname === '/wallets'
        ? 'profile'
        : pathname === '/'
          ? 'home'
          : null

  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 h-[126px] md:hidden">
      <img
        src="/figma/m-tabbar-bg.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute left-[-7.25%] top-[-9px] h-[155px] w-[114.5%] max-w-none"
      />
      <Link
        to="/"
        hash="catalogo"
        aria-label="Explorar coleções"
        className="absolute left-1/2 top-0 grid size-[65px] -translate-x-1/2 place-items-center rounded-full bg-[linear-gradient(180deg,rgba(210,138,76,0.4)_-17%,#d28a4c_109%)] text-foreground"
      >
        <FigmaIcon name="m-tab-scan" width={27} height={24} original />
      </Link>
      <ul className="absolute inset-x-0 top-[61px] h-10">
        <TabItem to="/" label="Início" active={tab === 'home'} icon={<FigmaIcon name="m-tab-home" width={16} height={17} />} className="left-[calc(8.7%-10px)]" />
        <TabItem
          to="/profile"
          search={{ section: 'interesse' }}
          label="Lista de interesse"
          active={tab === 'favorites'}
          icon={<FigmaIcon name="m-tab-heart" width={20} height={18} />}
          className="left-[calc(26.09%-10px)]"
        />
        <TabItem
          to="/cart"
          label={count ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho'}
          active={tab === 'cart'}
          icon={<FigmaIcon name="m-tab-shop" width={20} />}
          badge={count}
          className="left-[calc(70.53%-10px)]"
        />
        <TabItem to="/profile" label="Perfil" active={tab === 'profile'} icon={<FigmaIcon name="m-tab-user" width={20} />} className="left-[calc(85.51%-10px)]" />
      </ul>
    </nav>
  )
}

function TabItem({
  to,
  search,
  label,
  icon,
  active,
  badge,
  className,
}: {
  to: '/' | '/cart' | '/profile'
  search?: { section: 'interesse' }
  label: string
  icon: React.ReactNode
  active: boolean
  badge?: number
  className?: string
}) {
  return (
    <li className={cn('absolute top-0', className)}>
      <Link
        to={to}
        search={search ?? {}}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={cn('relative grid size-10 place-items-center', active ? 'text-accent' : 'text-muted-foreground')}
      >
        {icon}
        {badge ? (
          <span
            data-testid="cart-count"
            aria-hidden
            className="absolute right-0.5 top-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground"
          >
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </Link>
    </li>
  )
}

/** Cabeçalho das telas internas no mobile: voltar + título (Carrinho, Pagamento…). */
export function MobileScreenHeader({ title, className }: { title: string; className?: string }) {
  const router = useRouter()
  return (
    <div className={cn('flex h-11 items-start gap-3 md:hidden', className)}>
      <button
        type="button"
        aria-label="Voltar"
        onClick={() => (window.history.length > 1 ? router.history.back() : void router.navigate({ to: '/' }))}
        className="grid size-[35px] shrink-0 place-items-center rounded-full border border-border bg-surface-raised text-subtle"
      >
        <FigmaIcon name="m-back-arrow" width={13} height={7} className="rotate-90" />
      </button>
      <h1 className="min-w-0 flex-1 text-balance break-words pr-2 pt-[9px] text-center text-xl font-bold leading-4 text-foreground">{title}</h1>
    </div>
  )
}
