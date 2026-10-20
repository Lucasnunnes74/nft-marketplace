import { useEffect, useState } from 'react'
import {
  type Category,
  categories,
  categoryLabels,
  type Chain,
  chainLabels,
  chains,
  type NftList,
} from '@/api/contracts'
import { cn } from '@/lib/utils'

const formatBr = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export type FilterValues = {
  category?: Category
  chain?: Chain
  minPrice?: string
  maxPrice?: string
}

/** Painel "Filters" do layout (310px, fundo #241612): coleções, faixa de preço e rede. */
export function Filters({
  values,
  facets,
  onChange,
  className,
}: {
  values: FilterValues
  facets: NftList['facets'] | undefined
  onChange: (patch: Partial<FilterValues>) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-10 bg-card p-5', className)}>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-bold leading-4 text-foreground">Coleções</legend>
        <ul className="px-3">
          {categories.map((c) => {
            const active = values.category === c
            const count = facets?.categories[c]
            return (
              <li key={c}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ category: active ? undefined : c })}
                  className={cn(
                    'flex w-full items-start justify-between text-[15px] leading-10 hover:text-accent',
                    active ? 'text-accent' : 'text-muted-foreground',
                  )}
                >
                  <span className={cn(active && 'underline decoration-1 underline-offset-4')}>{categoryLabels[c]}</span>
                  <span className="font-bold">
                    {count !== undefined ? `(${count})` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <PriceRange
        key={`${values.minPrice ?? ''}-${values.maxPrice ?? ''}-${facets?.price.min ?? ''}-${facets?.price.max ?? ''}`}
        bounds={facets ? { min: Number(facets.price.min), max: Number(facets.price.max) } : undefined}
        value={{ min: values.minPrice, max: values.maxPrice }}
        onApply={(min, max) => onChange({ minPrice: min, maxPrice: max })}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-bold leading-4 text-foreground">Rede</legend>
        <ul className="pl-3">
          {chains.map((c) => {
            const active = values.chain === c
            const count = facets?.chains[c]
            return (
              <li key={c}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ chain: active ? undefined : c })}
                  className={cn(
                    'flex w-full items-start justify-between text-[15px] leading-10 hover:text-accent',
                    active ? 'text-accent' : 'text-muted-foreground',
                  )}
                >
                  <span className={cn(active && 'underline decoration-1 underline-offset-4')}>{chainLabels[c]}</span>
                  <span>{count !== undefined ? `(${count})` : ''}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </fieldset>
    </div>
  )
}

/** Controle de faixa com dois cursores; só altera a busca ao clicar em "Aplicar". */
function PriceRange({
  bounds,
  value,
  onApply,
}: {
  bounds: { min: number; max: number } | undefined
  value: { min?: string; max?: string }
  onApply: (min: string | undefined, max: string | undefined) => void
}) {
  const lo = bounds?.min ?? 0
  const hi = bounds?.max ?? 0
  const [min, setMin] = useState(value.min !== undefined ? Number(value.min) : lo)
  const [max, setMax] = useState(value.max !== undefined ? Number(value.max) : hi)
  useEffect(() => {
    setMin(value.min !== undefined ? Number(value.min) : lo)
    setMax(value.max !== undefined ? Number(value.max) : hi)
  }, [value.min, value.max, lo, hi])
  const disabled = !bounds || hi <= lo
  const span = hi - lo || 1
  const left = ((Math.min(min, max) - lo) / span) * 100
  const right = ((Math.max(min, max) - lo) / span) * 100

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-lg font-bold leading-4 text-foreground">Faixa de preço</legend>
      <div className="flex flex-col gap-3 pl-3">
        <div className="relative h-[15px]">
          <span aria-hidden className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary/35" />
          <span
            aria-hidden
            className="absolute top-1/2 h-1 -translate-y-1/2 bg-primary"
            style={{ left: `${left}%`, right: `${100 - right}%` }}
          />
          <input
            type="range"
            aria-label="Preço mínimo (ETH)"
            className="k-range"
            min={lo}
            max={hi}
            step={0.01}
            disabled={disabled}
            value={min}
            onChange={(e) => setMin(Math.min(Number(e.target.value), max))}
          />
          <input
            type="range"
            aria-label="Preço máximo (ETH)"
            className="k-range"
            min={lo}
            max={hi}
            step={0.01}
            disabled={disabled}
            value={max}
            onChange={(e) => setMax(Math.max(Number(e.target.value), min))}
          />
        </div>
        <p className="text-[15px] leading-normal text-foreground" aria-live="polite">
          Preço: {formatBr(Math.min(min, max))} - {formatBr(Math.max(min, max))} ETH
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onApply(min <= lo ? undefined : round(min).toFixed(2), max >= hi ? undefined : round(max).toFixed(2))}
          className="self-start rounded-[6px] bg-primary px-3 py-2 text-base font-bold leading-5 text-primary-foreground hover:brightness-110 disabled:opacity-50"
        >
          Aplicar
        </button>
      </div>
    </fieldset>
  )
}

const round = (n: number) => Math.round(n * 100) / 100
