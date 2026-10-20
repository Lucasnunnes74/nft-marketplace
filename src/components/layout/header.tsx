import { Link, useLocation, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useSessionState } from '@/auth/use-session'
import { FigmaIcon } from '@/components/ui/figma-icon'
import { useCart, useCurrentUser } from '@/hooks/use-api'
import { cn } from '@/lib/utils'

/** Telas do fluxo de compra destacam "Mercado"; as demais, "Início" (regra do componente Header Row). */
const marketPaths = ['/nft/', '/cart', '/checkout', '/orders/']

export function useActiveSection(): 'home' | 'market' {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return marketPaths.some((p) => pathname.startsWith(p)) ? 'market' : 'home'
}

const navItems = [
  { key: 'home', label: 'Início', hash: undefined },
  { key: 'market', label: 'Mercado', hash: 'catalogo' },
  { key: 'creators', label: 'Criadores', hash: 'destaques' },
  { key: 'learn', label: 'Aprenda', hash: 'diario' },
] as const

export function useCartCount() {
  const cart = useCart()
  return cart.data?.items.reduce((n, i) => n + i.quantity, 0) ?? 0
}

export function Header() {
  const active = useActiveSection()
  const count = useCartCount()
  const { isAuthenticated } = useSessionState()
  const user = useCurrentUser()
  // Telas de mercado usam o Header Row sem o divisor (descrição do componente no Figma).
  const withDivider = active === 'home'

  return (
    <header className="pt-6">
      <div className="flex items-start justify-between">
        <Link to="/" search={{}} className="block h-[34px] w-40 pt-2 text-sm font-bold leading-normal tracking-[1.4px] text-foreground">
          KURIO
        </Link>

        <nav aria-label="Principal">
          <ul className="flex items-start gap-10">
            {navItems.map((item) => {
              const isActive = item.key === active
              return (
                <li key={item.key}>
                  <Link
                    to="/"
                    hash={item.hash}
                    search={item.key === 'home' ? {} : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className="group flex flex-col gap-6 text-base leading-normal"
                  >
                    <span className={isActive ? 'font-bold text-accent' : 'text-foreground group-hover:text-accent'}>{item.label}</span>
                    <span aria-hidden className={cn('h-[3px] w-full', isActive ? 'bg-primary' : 'bg-transparent')} />
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-7">
          <HeaderSearch />
          <Link
            to="/cart"
            aria-label={count ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho'}
            className="relative grid h-6 w-[31px] text-foreground hover:text-accent"
          >
            <FigmaIcon name="icon-cart" width={24} />
            {count > 0 ? (
              <span
                data-testid="cart-count"
                aria-hidden
                className="absolute left-[15px] top-0 grid size-4 place-items-center rounded-full border-2 border-background bg-primary text-[10px] font-medium leading-none text-primary-foreground"
              >
                {count > 99 ? '99+' : count}
              </span>
            ) : null}
          </Link>
          {isAuthenticated ? (
            <Link
              to="/profile"
              aria-label="Meu perfil"
              className="flex h-[35px] min-w-[100px] max-w-44 items-center justify-center gap-1 rounded-[6px] bg-primary px-3 text-base font-medium text-primary-foreground hover:brightness-110"
            >
              <FigmaIcon name="acc-user" width={18} />
              <span className="truncate">{user.data?.user.name.split(' ')[0] ?? 'Perfil'}</span>
            </Link>
          ) : (
            <Link
              to="/login"
              search={{}}
              className="flex h-[35px] w-[100px] items-center justify-center gap-1 rounded-[6px] bg-primary text-base font-medium text-primary-foreground hover:brightness-110"
            >
              <FigmaIcon name="icon-login" width={20} height={19} />
              Entrar
            </Link>
          )}
        </div>
      </div>
      {withDivider ? <div className="k-hairline -mt-px" /> : null}
    </header>
  )
}

/** Busca do cabeçalho: abre um campo que escreve `q` na URL do catálogo. */
function HeaderSearch() {
  const navigate = useNavigate()
  const location = useLocation()
  const onHome = location.pathname === '/'
  const urlQ = onHome ? ((location.search as { q?: string }).q ?? '') : ''
  const [open, setOpen] = useState(Boolean(urlQ))
  const [value, setValue] = useState(urlQ)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => setValue(urlQ), [urlQ])
  useEffect(() => () => clearTimeout(timer.current), [])

  function commit(next: string, scroll: boolean) {
    clearTimeout(timer.current)
    void navigate({
      to: '/',
      search: (prev) => ({ ...(onHome ? prev : {}), q: next.trim() || undefined, page: undefined }),
      replace: onHome,
      resetScroll: false,
    }).then(() => {
      if (scroll) document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <form
      role="search"
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        commit(value, true)
      }}
    >
      {open ? (
        <>
          <label htmlFor="header-search" className="sr-only">
            Buscar
          </label>
          <input
            id="header-search"
            ref={inputRef}
            type="search"
            autoComplete="off"
            placeholder="Buscar NFTs, coleções…"
            value={value}
            onChange={(e) => {
              const next = e.target.value
              setValue(next)
              // No catálogo os resultados acompanham a digitação; fora dele, a busca vai no Enter.
              if (onHome) {
                clearTimeout(timer.current)
                timer.current = setTimeout(() => commit(next, false), 350)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false)
              }
            }}
            className="h-8 w-56 rounded-[6px] border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-primary"
          />
        </>
      ) : null}
      <button
        type={open ? 'submit' : 'button'}
        aria-label={open ? 'Pesquisar' : 'Abrir busca'}
        aria-expanded={open}
        className="grid size-6 place-items-center text-foreground hover:text-accent"
        onClick={(e) => {
          if (!open) {
            e.preventDefault()
            setOpen(true)
            requestAnimationFrame(() => inputRef.current?.focus())
          }
        }}
      >
        <FigmaIcon name="icon-search" width={20} />
      </button>
    </form>
  )
}
