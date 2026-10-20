import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

/** Preço em ETH. Mantém o valor exato visível via title (sem arredondar silenciosamente). */
export function Price({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn('tabular-nums', className)} title={`${value} ETH`}>
      {formatEth(value)}
    </span>
  )
}
