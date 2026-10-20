import type { Quote } from '@/api/contracts'
import { networkLabels } from '@/api/contracts'
import { cmpEth, formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { Price } from './price'

/** Subtotal, desconto, taxa e total vindos da cotação do servidor (nunca calculados no cliente). */
export function QuoteTotals({
  quote,
  stale,
  className,
  feeNoteAlign = 'end',
  totalDivider,
}: {
  quote: Quote
  stale?: boolean
  className?: string
  feeNoteAlign?: 'end' | 'center'
  totalDivider?: boolean
}) {
  const hasDiscount = cmpEth(quote.discount, '0') > 0
  return (
    <dl className={cn('flex flex-col gap-3 text-foreground transition-opacity', stale && 'opacity-70', className)} aria-busy={stale}>
      <div className="flex items-center justify-between gap-3">
        <dt className="text-[15px] leading-normal">Subtotal</dt>
        <dd data-testid="quote-subtotal" className="text-right text-base leading-4 md:text-lg">
          <Price value={quote.subtotal} />
        </dd>
      </div>
      <div className="flex items-center justify-between gap-3 text-[15px] leading-normal">
        <dt>
          Desconto do lançamento
          {quote.coupon?.status === 'applied' ? <span className="text-accent"> ({quote.coupon.code})</span> : null}
        </dt>
        <dd data-testid={hasDiscount ? 'quote-discount' : undefined} className={cn(hasDiscount && 'text-success')}>
          (-) {hasDiscount ? formatEth(quote.discount) : '00.00'}
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[15px] leading-normal">
            Taxa de rede<span className="sr-only"> ({networkLabels[quote.network]})</span>
          </dt>
          <dd data-testid="quote-fee" className="text-right text-base leading-4 md:text-lg">
            <Price value={quote.networkFee} />
          </dd>
        </div>
        <p className={cn('text-xs leading-4 text-accent', feeNoteAlign === 'center' ? 'text-center' : 'text-right')}>
          Taxa estimada · {networkLabels[quote.network]}
        </p>
      </div>
      {totalDivider ? <div className="k-hairline" /> : null}
      <div className="flex items-center justify-between gap-3 pt-3 font-bold leading-4">
        <dt className="text-base">Total</dt>
        <dd data-testid="quote-total" className="text-right text-lg text-accent">
          <Price value={quote.total} />
        </dd>
      </div>
    </dl>
  )
}
