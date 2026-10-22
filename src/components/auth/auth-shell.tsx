import { Link, useNavigate } from '@tanstack/react-router'
import type * as React from 'react'
import { useState } from 'react'
import { Hero, Promos } from '@/components/marketing/sections'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { FigmaIcon } from '@/components/ui/figma-icon'
import { useIsDesktop } from '@/hooks/use-media'
import { safeRedirect } from '@/lib/format'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'signup'

/**
 * Desktop: modal 500px sobre a página do mercado (fundo inerte, com scrim), como no layout.
 * Mobile: tela cheia com a marca KURIO.
 */
export function AuthShell({
  mode,
  redirect,
  title,
  description,
  mobileTitle,
  footer,
  children,
}: {
  mode: Mode
  redirect?: string
  title: string
  description: string
  mobileTitle: string
  footer: React.ReactNode
  children: React.ReactNode
}) {
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const close = () => void navigate({ to: safeRedirect(redirect), replace: true })

  if (!isDesktop) {
    return (
      <div className="-mt-10 flex min-h-dvh flex-col gap-10 pb-6 pt-20">
        <p aria-hidden className="flex h-[136px] items-center justify-center text-[32px] font-bold tracking-[3.2px] text-foreground">
          KURIO
        </p>
        <h1 className="text-center text-xl font-bold leading-6 text-foreground">{mobileTitle}</h1>
        <p className="sr-only">{description}</p>
        {children}
        <SocialBlock mobile />
        <div className="flex justify-center text-[15px] leading-normal text-muted-foreground">{footer}</div>
      </div>
    )
  }

  return (
    <>
      {/* Página do mercado ao fundo, como no layout: apenas visual, fora da árvore de acessibilidade. */}
      <div aria-hidden inert className="pointer-events-none flex select-none flex-col gap-24">
        <Hero />
        <Promos />
      </div>
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent className="top-[max(1rem,min(160px,calc(50dvh-330px)))] max-h-[calc(100dvh-2rem)] max-w-[500px] translate-y-0 gap-0 overflow-y-auto rounded-none border-0 bg-card p-0">
          <div className="flex flex-col items-center gap-10 px-12 pt-12">
            <nav aria-label="Acesso" className="flex items-stretch gap-2 text-xl font-medium leading-4">
              <AuthTab to="/login" active={mode === 'login'} redirect={redirect}>
                Entrar
              </AuthTab>
              <span aria-hidden className="w-px bg-coral" />
              <AuthTab to="/signup" active={mode === 'signup'} redirect={redirect}>
                Criar conta
              </AuthTab>
            </nav>
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <DialogDescription className="text-center text-[13px] font-normal leading-4 text-foreground">{description}</DialogDescription>
          </div>
          {children}
          <SocialBlock />
          <div className="flex justify-center px-20 pb-8 pt-6 text-[13px] text-muted-foreground">{footer}</div>
          {/* Faixa de base no fluxo do conteúdo: absoluta, ela ficava no meio do formulário quando o painel rolava. */}
          <span aria-hidden data-testid="auth-bottom-bar" className="block h-2.5 bg-primary" />
        </DialogContent>
      </Dialog>
    </>
  )
}

function AuthTab({ to, active, redirect, children }: { to: '/login' | '/signup'; active: boolean; redirect?: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      search={{ redirect }}
      replace
      aria-current={active ? 'page' : undefined}
      className={cn('py-1', active ? 'text-accent underline decoration-transparent' : 'text-foreground hover:text-accent')}
    >
      {children}
    </Link>
  )
}

/** "Ou continue com" + Google/Facebook. Login social não existe na simulação: avisa em vez de fingir. */
function SocialBlock({ mobile }: { mobile?: boolean }) {
  const [message, setMessage] = useState<string | null>(null)
  const providers = [
    { name: 'Google', icon: <FigmaIcon name="logo-google" width={20} original /> },
    { name: 'Facebook', icon: <FigmaIcon name="logo-facebook" width={20} original /> },
  ]
  return (
    <div className={cn('flex flex-col', mobile ? 'gap-3' : 'gap-3 pt-6')}>
      <div className={cn('flex items-center', mobile ? 'gap-2.5' : 'gap-3')}>
        <span aria-hidden className="h-px flex-1 bg-border" />
        <p className="text-[13px] leading-4 text-foreground">Ou continue com</p>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
      <div className={cn('flex flex-col', mobile ? 'gap-4' : 'gap-3 px-20')}>
        {providers.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => setMessage(`Entrar com ${p.name} não está disponível nesta demonstração. Use e-mail e senha.`)}
            className="flex h-10 items-center justify-center gap-3 rounded-[5px] border border-border text-[13px] font-medium leading-4 text-muted-foreground hover:border-border-soft hover:text-foreground"
          >
            {p.icon}
            Continuar com {p.name}
          </button>
        ))}
        <p aria-live="polite" className={cn('text-center text-xs text-accent', !message && 'sr-only')}>
          {message}
        </p>
      </div>
    </div>
  )
}

/** Estilos dos campos das telas de acesso (desktop 40px/raio 5; mobile 50px/raio 10). */
export function useAuthFieldClass() {
  const isDesktop = useIsDesktop()
  return isDesktop ? 'h-10 rounded-[5px] px-4' : 'h-[50px] rounded-[10px] px-4'
}
