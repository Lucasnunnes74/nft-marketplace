import { Link } from '@tanstack/react-router'
import { type SortOption, sortLabels, sortOptions } from '@/api/contracts'
import { ErrorState } from '@/components/common/states'
import { FigmaIcon } from '@/components/ui/figma-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { useFeatured } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import type { CatalogTab, HomeSearch } from '@/search-schemas'

/** "NFT em destaque / Oferta limitada" (barra lateral, 310×470). */
export function FeaturedBanner() {
  const featured = useFeatured()
  const nft = featured.data?.items[0]

  return (
    <section
      aria-labelledby="featured-title"
      className="relative flex h-[470px] w-full flex-col gap-4 overflow-hidden bg-[linear-gradient(180deg,rgba(210,138,76,0.1),rgba(210,138,76,0.03))] pb-1 pt-6"
    >
      <div className="flex flex-col items-center gap-4 px-5">
        <h2 id="featured-title" className="w-full text-2xl font-bold leading-8 text-accent">
          NFT EM DESTAQUE
        </h2>
        <p className="w-full text-center text-[22px] font-bold leading-4 text-foreground">OFERTA LIMITADA</p>
      </div>
      {featured.isError ? (
        <ErrorState compact error={featured.error} onRetry={() => void featured.refetch()} retrying={featured.isFetching} />
      ) : nft ? (
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="group relative block h-[368px] w-full overflow-hidden rounded-[22px]">
          <img
            src={nft.image.replace('-sm.webp', '.webp')}
            alt={`${nft.name} — ver oferta`}
            loading="lazy"
            width={310}
            height={368}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </Link>
      ) : (
        <Skeleton className="h-[368px] w-full rounded-[22px] bg-surface-raised" />
      )}
      <span aria-hidden className="absolute left-4 top-[299px] size-[22px] rounded-[7px] border-2 border-[#46a358] opacity-20" />
      <span
        aria-hidden
        className="absolute left-[248px] top-[343px] size-[45px] rounded-[29px] bg-[linear-gradient(145.5deg,rgba(210,138,76,0.3)_46%,rgba(210,138,76,0)_103%)]"
      />
      <span
        aria-hidden
        className="absolute left-[38px] top-[105px] size-[15px] rounded-[29px] bg-[linear-gradient(145.5deg,rgba(210,138,76,0.3)_46%,rgba(210,138,76,0)_103%)]"
      />
    </section>
  )
}

const tabs: { key: CatalogTab; label: string }[] = [
  { key: 'all', label: 'Todos os NFTs' },
  { key: 'new', label: 'Novos lançamentos' },
  { key: 'trending', label: 'Em alta' },
]

export function CatalogTabs({ active }: { active: CatalogTab }) {
  return (
    <nav aria-label="Seções do catálogo">
      <ul className="flex flex-wrap items-start gap-x-4 gap-y-2 text-sm leading-4 md:gap-x-5 md:text-[15px] md:font-medium">
        {tabs.map((t) => {
          const isActive = t.key === active
          return (
            <li key={t.key}>
              <Link
                to="/"
                search={(prev: HomeSearch) => ({ ...prev, tab: t.key === 'all' ? undefined : t.key, page: undefined })}
                replace
                resetScroll={false}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col gap-1 whitespace-nowrap md:gap-[7px]',
                  isActive ? 'font-bold text-accent md:font-medium' : 'text-foreground hover:text-accent',
                )}
              >
                {t.label}
                <span aria-hidden className={cn('h-0.5 w-full', isActive ? 'bg-primary' : 'bg-transparent')} />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function SortSelect({ value, onChange }: { value: SortOption; onChange: (v: SortOption) => void }) {
  return (
    <div className="flex items-center gap-2 text-[15px] leading-normal text-foreground">
      <label htmlFor="f-sort" className="whitespace-nowrap">
        Ordenar por:
      </label>
      <div className="relative">
        <select
          id="f-sort"
          value={value}
          onChange={(e) => onChange(e.target.value as SortOption)}
          className="cursor-pointer appearance-none bg-transparent pr-6 text-[15px] text-foreground outline-none focus-visible:underline"
        >
          {sortOptions.map((s) => (
            <option key={s} value={s} className="bg-card">
              {sortLabels[s]}
            </option>
          ))}
        </select>
        <FigmaIcon name="icon-chevron-down" width={9} height={5} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-foreground" />
      </div>
    </div>
  )
}

/** Paginação numerada (35×35, página atual preenchida). */
export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const pages = pageWindow(page, totalPages)
  const box = 'grid size-[35px] place-items-center rounded-[4px] text-lg leading-4'
  return (
    <nav aria-label="Paginação" className="flex items-center gap-2">
      <span className="sr-only" data-testid="page-indicator">
        Página {page} de {totalPages}
      </span>
      {page > 1 ? (
        <Link
          to="/"
          hash="catalogo"
          resetScroll={false}
          search={(prev: HomeSearch) => ({ ...prev, page: page - 1 <= 1 ? undefined : page - 1 })}
          aria-label="Página anterior"
          className={cn(box, 'border border-border text-foreground hover:border-primary')}
        >
          <FigmaIcon name="icon-chevron-right" width={12} height={7} className="rotate-90" />
        </Link>
      ) : null}
      {pages.map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} aria-hidden className="px-1 text-foreground">
            …
          </span>
        ) : (
          <Link
            key={p}
            to="/"
            hash="catalogo"
            resetScroll={false}
            search={(prev: HomeSearch) => ({ ...prev, page: p === 1 ? undefined : p })}
            aria-label={`Página ${p}`}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              box,
              p === page ? 'bg-primary font-bold text-primary-foreground' : 'border border-border text-foreground hover:border-primary',
            )}
          >
            {p}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link
          to="/"
          hash="catalogo"
          resetScroll={false}
          search={(prev: HomeSearch) => ({ ...prev, page: page + 1 })}
          aria-label="Próxima página"
          className={cn(box, 'border border-border text-foreground hover:border-primary')}
        >
          <FigmaIcon name="icon-chevron-right" width={12} height={7} className="-rotate-90" />
        </Link>
      ) : null}
    </nav>
  )
}

function pageWindow(page: number, total: number): (number | 'gap')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const start = Math.max(1, Math.min(page - 1, total - 3))
  const out: (number | 'gap')[] = []
  if (start > 1) out.push(1, 'gap')
  for (let p = start; p <= Math.min(total, start + 3); p++) out.push(p)
  if (start + 3 < total) out.push('gap', total)
  return out
}

export function CatalogGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="rounded-[20px] bg-card px-1 pb-5 pt-3 md:rounded-none md:pb-[26px] md:pt-6">
            <Skeleton className="aspect-square w-full rounded-2xl bg-surface-raised md:rounded-[15px]" />
          </div>
          <Skeleton className="h-4 w-3/4 bg-card" />
          <Skeleton className="h-4 w-1/3 bg-card" />
        </div>
      ))}
    </>
  )
}
