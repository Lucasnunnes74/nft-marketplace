import { Link } from '@tanstack/react-router'
import { AlertTriangle, PackageSearch, RefreshCw } from 'lucide-react'
import type * as React from 'react'
import { ApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-soft bg-card/40 px-6 py-14 text-center', className)}>
      <div className="text-accent">{icon ?? <PackageSearch aria-hidden className="size-10" />}</div>
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      {description ? <p className="max-w-md text-sm leading-6 text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  )
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  return 'Algo deu errado. Tente novamente.'
}

export function ErrorState({
  error,
  onRetry,
  title = 'Não foi possível carregar',
  retrying,
  compact,
  className,
}: {
  error: unknown
  onRetry?: () => void
  title?: string
  retrying?: boolean
  compact?: boolean
  className?: string
}) {
  const offline = error instanceof ApiError && (error.code === 'NETWORK' || error.code === 'TIMEOUT')
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-coral/40 bg-coral/5 text-center',
        compact ? 'px-4 py-6' : 'px-6 py-12',
        className,
      )}
    >
      <AlertTriangle aria-hidden className={cn('text-coral', compact ? 'size-6' : 'size-9')} />
      <h2 className={cn('font-bold text-foreground', compact ? 'text-sm' : 'text-lg')}>{offline ? 'Problema de conexão' : title}</h2>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="outline" size={compact ? 'sm' : 'default'} onClick={onRetry} disabled={retrying}>
          <RefreshCw aria-hidden className={retrying ? 'animate-spin' : ''} /> Tentar novamente
        </Button>
      ) : null}
    </div>
  )
}

export function NotFoundState({ title = 'Página não encontrada', description }: { title?: string; description?: string }) {
  return (
    <EmptyState
      title={title}
      description={description ?? 'O endereço pode estar incorreto ou o conteúdo foi removido.'}
      action={
        <Button asChild>
          <Link to="/">Voltar ao início</Link>
        </Button>
      }
    />
  )
}

export function Spinner({ label }: { label: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      {label}
    </span>
  )
}

/** Trilha "Início / Mercado / …" das telas de mercado (15px, negrito). */
export function Breadcrumb({ items }: { items: { label: string; to?: '/' | '/cart'; hash?: string }[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="hidden md:block">
      <ol className="flex flex-wrap items-center text-[15px] font-bold leading-4 text-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={item.label} className="flex items-center">
              {item.to && !last ? (
                <Link to={item.to} hash={item.hash} className="hover:text-accent">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined}>{item.label}</span>
              )}
              {!last ? (
                <span aria-hidden className="whitespace-pre">
                  {' / '}
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
