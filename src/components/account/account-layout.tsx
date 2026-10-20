import { Link, useNavigate } from '@tanstack/react-router'
import type * as React from 'react'
import { FigmaIcon } from '@/components/ui/figma-icon'
import { useLogout } from '@/hooks/use-api'
import { cn } from '@/lib/utils'

type Section = 'dados' | 'carteiras' | 'interesse'

const itemClass = 'flex items-center gap-3 px-4 text-[15px] leading-[45px] text-accent'

/** Barra lateral "Meu perfil" (310px, #241612) das telas de conta. */
export function AccountLayout({ active, children }: { active: Section; children: React.ReactNode }) {
  const logout = useLogout()
  const navigate = useNavigate()

  const links: { key: Section; label: string; icon: React.ReactNode; to: '/profile' | '/wallets'; search?: { section: 'interesse' } }[] = [
    {
      key: 'dados',
      label: 'Dados do perfil',
      to: '/profile',
      icon: <FigmaIcon name="acc-user" width={18} />,
    },
    { key: 'carteiras', label: 'Carteiras', to: '/wallets', icon: <FigmaIcon name="acc-location" width={14} height={16} className="mx-[3px]" /> },
  ]
  const soon = [
    { label: 'Atividade', icon: <FigmaIcon name="acc-shopping" width={18} /> },
  ]
  const after = [
    { label: 'Ofertas', icon: <FigmaIcon name="acc-activity" width={16} className="mx-px" /> },
    { label: 'Arquivos baixados', icon: <FigmaIcon name="acc-download" width={16} className="mx-px" /> },
    { label: 'Suporte', icon: <FigmaIcon name="acc-danger" width={16} height={15} className="mx-px" /> },
  ]

  return (
    <div className="flex flex-col gap-7 md:flex-row md:items-start">
      <nav aria-label="Minha conta" className="flex w-full shrink-0 flex-col bg-card py-2 md:w-[310px]">
        <h1 className="p-2.5 text-lg font-bold leading-4 text-foreground">Meu perfil</h1>
        <ul className="flex flex-col">
          {links.map((l) => (
            <AccountLink key={l.key} label={l.label} to={l.to} search={l.search} icon={l.icon} active={active === l.key} />
          ))}
          {soon.map((s) => (
            <SoonItem key={s.label} {...s} />
          ))}
          <AccountLink
            label="Lista de interesse"
            to="/profile"
            search={{ section: 'interesse' }}
            active={active === 'interesse'}
            icon={<FigmaIcon name="acc-heart" width={16} className="mx-px" />}
          />
          {after.map((s) => (
            <SoonItem key={s.label} {...s} />
          ))}
        </ul>
        <div className="k-hairline" />
        <button
          type="button"
          disabled={logout.isPending}
          onClick={() => logout.mutate(undefined, { onSettled: () => void navigate({ to: '/', search: {} }) })}
          className="flex h-10 items-center gap-2 px-4 text-left text-[15px] font-bold leading-[15px] text-accent hover:brightness-110 disabled:opacity-60"
        >
          <FigmaIcon name="acc-logout" width={18} height={17} />
          {logout.isPending ? 'Saindo…' : 'Sair'}
        </button>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function AccountLink({
  label,
  to,
  search,
  icon,
  active,
}: {
  label: string
  to: '/profile' | '/wallets'
  search?: { section: 'interesse' }
  icon: React.ReactNode
  active: boolean
}) {
  return (
    <li>
      <Link
        to={to}
        search={search ?? {}}
        aria-current={active ? 'page' : undefined}
        className={cn(itemClass, 'border-l-[6px] hover:brightness-110', active ? 'border-primary' : 'border-transparent', active && label === 'Dados do perfil' && 'gap-4')}
      >
        <span className={cn(active ? 'text-primary' : 'text-muted-foreground')}>{icon}</span>
        {label}
      </Link>
    </li>
  )
}

/** Seções do layout ainda sem tela: aparecem como no design, sem fingir ser links. */
function SoonItem({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <li className={cn(itemClass, 'border-l-[6px] border-transparent')} title="Em breve">
      <span>{icon}</span>
      {label}
      <span className="sr-only"> (em breve)</span>
    </li>
  )
}
