import { FigmaIcon } from '@/components/ui/figma-icon'
import { cn } from '@/lib/utils'

const variants = {
  /** Detalhe desktop: círculos de 33px, número 20px. */
  round: {
    gap: 'gap-3',
    button: 'size-[33px] rounded-full border border-background bg-primary shadow-[0_6.6px_9.9px_rgba(20,13,10,0.15)]',
    icon: 26,
    value: 'min-w-3 text-xl leading-7',
  },
  /** Carrinho desktop e detalhe mobile: pílula 20×30. */
  pill: {
    gap: 'gap-3',
    button: 'h-[30px] w-5 rounded-[20px] border border-background bg-primary shadow-[0_4px_6px_rgba(20,13,10,0.15)]',
    icon: 16,
    value: 'min-w-3 text-[17px] leading-6',
  },
  /** Carrinho mobile: círculos de 24px com contorno. */
  outline: {
    gap: 'gap-3',
    button: 'size-6 rounded-full border border-border bg-surface-raised text-foreground',
    icon: 0,
    value: 'min-w-3 text-base leading-[22px]',
  },
} as const

export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  disabled,
  label,
  variant = 'pill',
  className,
}: {
  value: number
  min?: number
  max: number
  onChange: (next: number) => void
  disabled?: boolean
  label: string
  variant?: keyof typeof variants
  className?: string
}) {
  const v = variants[variant]
  const decDisabled = disabled || value <= min
  const incDisabled = disabled || value >= max
  return (
    <div role="group" aria-label={label} className={cn('inline-flex items-center', v.gap, className)}>
      <button
        type="button"
        aria-label="Diminuir quantidade"
        disabled={decDisabled}
        onClick={() => onChange(value - 1)}
        className={cn('grid shrink-0 cursor-pointer place-items-center text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40', v.button)}
      >
        {variant === 'outline' ? (
          <span aria-hidden className={cn('h-0.5 w-[9px] rounded', decDisabled ? 'bg-border-soft' : 'bg-foreground')} />
        ) : (
          <FigmaIcon name={variant === 'round' ? 'icon-minus' : 'icon-minus-sm'} width={v.icon} />
        )}
      </button>
      <output aria-live="polite" aria-label={`${label}: ${value}`} className={cn('text-center tabular-nums text-foreground', v.value)}>
        {value}
      </output>
      <button
        type="button"
        aria-label="Aumentar quantidade"
        disabled={incDisabled}
        onClick={() => onChange(value + 1)}
        className={cn('grid shrink-0 cursor-pointer place-items-center text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40', v.button)}
      >
        {variant === 'outline' ? (
          <span aria-hidden className="text-[21px] leading-4">
            +
          </span>
        ) : (
          <FigmaIcon name={variant === 'round' ? 'icon-plus' : 'icon-plus-sm'} width={v.icon} />
        )}
      </button>
    </div>
  )
}
