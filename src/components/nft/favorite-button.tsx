import { useLocation, useNavigate } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { useSessionState } from '@/auth/use-session'
import { FigmaIcon } from '@/components/ui/figma-icon'
import { useToggleFavorite } from '@/hooks/use-api'
import { cn } from '@/lib/utils'

/**
 * Favoritar exige sessão: sem login, leva ao login e volta para a mesma tela.
 * `button`: botão "Favoritar" do detalhe (desktop). `chip`: círculo de 28/35px do mobile.
 */
export function FavoriteButton({
  nftId,
  name,
  isFavorite,
  variant = 'button',
  className,
}: {
  nftId: string
  name: string
  isFavorite: boolean
  variant?: 'button' | 'chip' | 'chip-lg'
  className?: string
}) {
  const { isAuthenticated } = useSessionState()
  const navigate = useNavigate()
  const location = useLocation()
  const toggle = useToggleFavorite()

  function onClick() {
    if (!isAuthenticated) {
      void navigate({ to: '/login', search: { redirect: location.href, reason: 'favorite' } })
      return
    }
    toggle.mutate({ nftId, next: !isFavorite })
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        aria-pressed={isFavorite}
        onClick={onClick}
        className={cn(
          'flex h-10 w-[130px] items-center justify-center gap-2 rounded-[6px] border border-primary text-sm font-medium leading-5 text-accent transition-colors hover:bg-primary/10',
          isFavorite && 'bg-primary/15',
          className,
        )}
      >
        <HeartIcon filled={isFavorite} size={20} />
        {isFavorite ? 'Favoritado' : 'Favoritar'}
      </button>
    )
  }

  const large = variant === 'chip-lg'
  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remover ${name} dos favoritos` : `Favoritar ${name}`}
      onClick={onClick}
      className={cn(
        'grid place-items-center rounded-full border border-border bg-surface-raised text-accent',
        large ? 'size-[35px]' : 'size-7',
        className,
      )}
    >
      <HeartIcon filled={isFavorite} size={large ? 16 : 14} />
    </button>
  )
}

/** Coração do layout: contorno quando livre, preenchido quando favoritado (não só cor). */
function HeartIcon({ filled, size }: { filled: boolean; size: number }) {
  return filled ? (
    <Heart aria-hidden fill="currentColor" strokeWidth={1.5} style={{ width: size, height: size }} className="shrink-0" />
  ) : (
    <FigmaIcon name="icon-heart-accent" width={size} height={size} />
  )
}
