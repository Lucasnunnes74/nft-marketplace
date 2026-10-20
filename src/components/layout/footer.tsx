import { Link } from '@tanstack/react-router'
import type * as React from 'react'
import { useId, useState } from 'react'
import { z } from 'zod'
import type { Category } from '@/api/contracts'
import { realtimeStatus } from '@/stores/realtime-status'
import { cn } from '@/lib/utils'

const features = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const helpLinks = ['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item']
const collectionLinks: { label: string; category: Category }[] = [
  { label: 'Arte digital', category: 'art' },
  { label: 'Fotografia', category: 'photography' },
  { label: 'Música', category: 'music' },
  { label: 'Arte 3D', category: '3d' },
  { label: 'Utilidade', category: 'utility' },
]
const socials = [
  { name: 'Facebook', icon: 'social-facebook' },
  { name: 'Instagram', icon: 'social-instagram' },
  { name: 'Twitter', icon: 'social-twitter' },
  { name: 'LinkedIn', icon: 'social-linkedin' },
  { name: 'YouTube', icon: 'social-youtube' },
]

const statusText = {
  connected: 'Ao vivo',
  connecting: 'Conectando…',
  reconnecting: 'Reconectando…',
  offline: 'Offline',
} as const

export function LiveIndicator({ className }: { className?: string }) {
  const status = realtimeStatus.use()
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)} title="Preços e estoque atualizados em tempo real">
      <span
        aria-hidden
        className={cn(
          'size-2 rounded-full',
          status === 'connected' ? 'bg-success' : status === 'offline' ? 'bg-subtle' : 'animate-pulse bg-warning',
        )}
      />
      <span>
        <span className="sr-only">Tempo real: </span>
        {statusText[status]}
      </span>
    </span>
  )
}

export function Footer() {
  return (
    <footer className="flex flex-col">
      <div className="bg-card px-6 py-8 md:p-8 xl:h-[250px]">
        <div className="flex flex-col gap-8 md:grid md:grid-cols-2 xl:flex xl:flex-row xl:items-end xl:justify-between xl:gap-0">
          {features.map((f, i) => (
            <div key={f.letter} className="flex xl:contents">
              <div className={cn('flex flex-col gap-3 px-4', i === 0 ? 'xl:flex-1' : 'xl:w-[264px]')}>
                <span aria-hidden className="grid size-[74px] place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                  {f.letter}
                </span>
                <p className="text-[17px] font-bold leading-4 text-foreground">{f.title}</p>
                <p className="w-[204px] max-w-full text-sm leading-[22px] text-muted-foreground">{f.text}</p>
              </div>
              <span aria-hidden className="hidden w-px self-stretch bg-primary xl:block" />
            </div>
          ))}
          <Newsletter />
        </div>
      </div>

      <div className="bg-surface-dark px-6 py-6 md:px-8 xl:h-[88px] xl:py-0">
        <div className="flex h-full flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:gap-x-8 xl:flex-nowrap xl:gap-[92px]">
          <p className="py-2 text-sm font-bold tracking-[1.4px] text-foreground md:flex-1">KURIO</p>
          <p className="text-sm leading-[22px] text-foreground md:flex-1 xl:whitespace-nowrap">
            Feito para colecionadores,
            <br />
            criadores e cultura
          </p>
          <p className="md:flex-1">
            <a href="mailto:contato@email.com" className="text-sm leading-[22px] text-foreground hover:text-accent">
              contato@email.com
            </a>
          </p>
          <p className="text-sm leading-[22px] text-foreground xl:w-[228px]">+55 11 4002 8922</p>
        </div>
      </div>

      <div className="bg-card px-6 py-8 md:p-8 xl:h-[236px]">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 xl:flex xl:gap-[124px]">
          <FooterColumn title="Meu perfil">
            <FooterLink to="/profile">Meu perfil</FooterLink>
            <FooterLink to="/profile">Minha coleção</FooterLink>
            <FooterLink to="/profile">Atividade</FooterLink>
            <FooterText>Estúdio do criador</FooterText>
            <FooterLink to="/profile" search={{ section: 'interesse' }}>
              Lista de interesse
            </FooterLink>
          </FooterColumn>
          <FooterColumn title="Central de ajuda">
            {helpLinks.map((l) => (
              <FooterText key={l}>{l}</FooterText>
            ))}
          </FooterColumn>
          <FooterColumn title="Coleções">
            {collectionLinks.map((c) => (
              <li key={c.category}>
                <Link to="/" search={{ category: c.category }} hash="catalogo" className="text-sm leading-[30px] text-foreground hover:text-accent">
                  {c.label}
                </Link>
              </li>
            ))}
          </FooterColumn>
          <div className="flex flex-col gap-8 xl:w-[228px]">
            <div className="flex w-[190px] flex-col gap-5">
              <h2 className="text-lg font-bold leading-4 text-foreground">Redes sociais</h2>
              <ul className="flex items-center gap-2.5">
                {socials.map((s) => (
                  <li key={s.name}>
                    <img src={`/figma/${s.icon}.svg`} alt={s.name} width={30} height={30} className="size-[30px]" />
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold leading-4 text-foreground">Carteiras compatíveis</h2>
              <WalletChip />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 pt-1.5 sm:flex-row sm:justify-center sm:gap-6">
        <p className="text-center text-sm leading-[30px] text-foreground">© 2026 Kurio. Propriedade digital para todos.</p>
        <LiveIndicator />
      </div>
    </footer>
  )
}

export function WalletChip({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        'flex h-[26px] items-center justify-center whitespace-pre rounded-[6px] border border-border-soft bg-surface-dark px-2 text-[9px] font-bold tracking-[0.1px] text-accent',
        className,
      )}
    >
      {'METAMASK  •  WALLETCONNECT  •  COINBASE'}
    </p>
  )
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 md:flex-1">
      <h2 className="text-lg font-bold leading-4 text-foreground">{title}</h2>
      <ul>{children}</ul>
    </div>
  )
}

function FooterLink({ to, search, children }: { to: '/profile'; search?: { section: 'interesse' }; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} search={search ?? {}} className="text-sm leading-[30px] text-foreground hover:text-accent">
        {children}
      </Link>
    </li>
  )
}

function FooterText({ children }: { children: React.ReactNode }) {
  return <li className="text-sm leading-[30px] text-foreground">{children}</li>
}

const emailSchema = z.email()

function Newsletter() {
  const id = useId()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  return (
    <form
      noValidate
      className="flex flex-col gap-3 px-4 md:col-span-2 xl:h-full xl:w-[357px]"
      onSubmit={(e) => {
        e.preventDefault()
        if (!emailSchema.safeParse(email.trim()).success) {
          setStatus({ ok: false, text: 'Informe um e-mail válido.' })
          return
        }
        setEmail('')
        setStatus({ ok: true, text: 'Inscrição registrada (simulação).' })
      }}
    >
      <div className="flex flex-col gap-4">
        <label htmlFor={id} className="text-lg font-bold leading-4 text-foreground">
          Antecipe-se ao próximo lançamento
        </label>
        <div className="flex h-10 items-center justify-between rounded-[6px] bg-surface-dark pl-3 shadow-[0_0_10px_rgba(10,6,4,0.45)]">
          <input
            id={id}
            type="email"
            autoComplete="email"
            placeholder="digite seu e-mail..."
            value={email}
            aria-invalid={status?.ok === false}
            aria-describedby={`${id}-status`}
            onChange={(e) => {
              setEmail(e.target.value)
              setStatus(null)
            }}
            className="h-full min-w-0 flex-1 bg-transparent text-sm leading-4 text-foreground outline-none"
          />
          <button
            type="submit"
            className="flex h-10 w-[85px] shrink-0 items-center justify-center rounded-r-[6px] bg-primary pl-4 pr-1 text-lg font-bold leading-4 text-primary-foreground hover:brightness-110"
          >
            Enviar
          </button>
        </div>
      </div>
      <p id={`${id}-status`} aria-live="polite" className={cn('text-[13px] leading-[22px]', status?.ok === false ? 'text-coral' : 'text-muted-foreground')}>
        {status?.text ?? 'Receba lançamentos selecionados, histórias de criadores e novidades do mercado.'}
      </p>
    </form>
  )
}
