import { getRouteApi } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { NftListParams } from '@/api/contracts'
import { CatalogGridSkeleton, CatalogTabs, FeaturedBanner, Pagination, SortSelect } from '@/components/catalog/catalog-parts'
import { type FilterValues, Filters } from '@/components/catalog/filters'
import { EmptyState, ErrorState } from '@/components/common/states'
import { Blog, Hero, Promos } from '@/components/marketing/sections'
import { NftCard } from '@/components/nft/nft-card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { FigmaIcon } from '@/components/ui/figma-icon'
import { useNftList } from '@/hooks/use-api'
import { useIsDesktop } from '@/hooks/use-media'
import { usePageTitle } from '@/hooks/use-page'
import { cn } from '@/lib/utils'
import type { HomeSearch } from '@/search-schemas'

const route = getRouteApi('/')
const PAGE_SIZE = 9

function toParams(s: HomeSearch): Partial<NftListParams> {
  return {
    q: s.q || undefined,
    category: s.category,
    chain: s.chain,
    minPrice: s.minPrice,
    maxPrice: s.maxPrice,
    availableOnly: s.available || undefined,
    featuredOnly: s.tab === 'trending' || undefined,
    newOnly: s.tab === 'new' || undefined,
    sort: s.sort ?? 'newest',
    page: s.page ?? 1,
    pageSize: PAGE_SIZE,
  }
}

function hasActiveFilters(s: HomeSearch) {
  return Boolean(s.q || s.category || s.chain || s.minPrice !== undefined || s.maxPrice !== undefined || s.available || s.tab)
}

export function HomePage() {
  usePageTitle('Início')
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const isDesktop = useIsDesktop()
  const list = useNftList(toParams(search))
  const filtersActive = hasActiveFilters(search)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Mudar qualquer filtro reinicia a paginação; a tela não rola para o topo.
  const update = (patch: Partial<HomeSearch>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }), replace: true, resetScroll: false })

  const clearAll = () => void navigate({ search: { sort: search.sort }, replace: true, resetScroll: false })

  // Página fora do intervalo (URL antiga/editada): volta para a última existente.
  const data = list.data
  useEffect(() => {
    if (!data) return
    if (data.totalPages > 0 && data.page > data.totalPages) {
      void navigate({ search: (prev) => ({ ...prev, page: data.totalPages > 1 ? data.totalPages : undefined }), replace: true })
    } else if (data.totalPages === 0 && data.page > 1) {
      void navigate({ search: (prev) => ({ ...prev, page: undefined }), replace: true })
    }
  }, [data, navigate])

  const page = search.page ?? 1
  const filterValues: FilterValues = {
    category: search.category,
    chain: search.chain,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
  }

  return (
    <div className="flex flex-col gap-4 md:gap-24">
      {!isDesktop ? <MobileSearchBar value={search.q ?? ''} onSearch={(q) => update({ q: q || undefined })} onOpenFilters={() => setFiltersOpen(true)} /> : null}

      <Hero />

      <section id="catalogo" aria-labelledby="catalogo-title" className="flex scroll-mt-6 items-start gap-12">
        <h2 id="catalogo-title" className="sr-only">
          Catálogo
        </h2>
        {isDesktop ? (
          <aside aria-label="Filtros do catálogo" className="flex w-[310px] shrink-0 flex-col gap-6">
            <Filters values={filterValues} facets={list.data?.facets} onChange={update} />
            <FeaturedBanner />
          </aside>
        ) : (
          <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
            <DialogContent className="max-h-[85dvh] overflow-y-auto p-0">
              <DialogTitle className="sr-only">Filtros do catálogo</DialogTitle>
              <DialogDescription className="sr-only">Refine os NFTs por coleção, preço e rede.</DialogDescription>
              <Filters
                values={filterValues}
                facets={list.data?.facets}
                onChange={(patch) => {
                  update(patch)
                  setFiltersOpen(false)
                }}
                className="pt-12"
              />
            </DialogContent>
          </Dialog>
        )}

        <div className="flex min-w-0 flex-1 flex-col items-end gap-10 md:gap-[88px]">
          <div className="flex w-full flex-col gap-4 md:gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <CatalogTabs active={search.tab ?? 'all'} />
              {isDesktop ? <SortSelect value={search.sort ?? 'newest'} onChange={(sort) => update({ sort })} /> : null}
            </div>

            <p aria-live="polite" className="sr-only" data-testid="result-count">
              {list.isSuccess ? `${list.data.total} ${list.data.total === 1 ? 'resultado' : 'resultados'}` : ''}
              {list.isFetching && list.isSuccess ? ' · atualizando…' : ''}
            </p>

            {filtersActive ? (
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>
                  {list.data ? `${list.data.total} ${list.data.total === 1 ? 'resultado' : 'resultados'}` : 'Filtrando…'}
                  {search.q ? ` para “${search.q}”` : ''}
                </span>
                <button type="button" onClick={clearAll} className="font-bold text-accent underline-offset-4 hover:underline">
                  Limpar filtros
                </button>
              </div>
            ) : null}

            {list.isError ? (
              <ErrorState error={list.error} onRetry={() => void list.refetch()} retrying={list.isFetching} />
            ) : list.isPending ? (
              <div className={gridClass} aria-busy aria-label="Carregando NFTs">
                <CatalogGridSkeleton count={isDesktop ? 9 : 4} />
              </div>
            ) : list.data.items.length === 0 ? (
              <EmptyState
                title="Nenhum NFT encontrado"
                description="Tente outros termos ou remova alguns filtros para ver mais resultados."
                action={
                  filtersActive ? (
                    <Button variant="outline" onClick={clearAll}>
                      Limpar filtros
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul
                className={cn(gridClass, 'transition-opacity')}
                style={{ opacity: list.isPlaceholderData ? 0.55 : 1 }}
                data-testid="catalog-grid"
              >
                {list.data.items.map((n) => (
                  <li key={n.id}>
                    <NftCard nft={n} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {list.data && list.data.totalPages > 1 ? <Pagination page={page} totalPages={list.data.totalPages} /> : null}
        </div>
      </section>

      <Promos />
      <Blog />
    </div>
  )
}

/**
 * Desktop largo: 3 colunas de 258px; tablet (768–1023px, com a barra de filtros ao lado): 2 colunas;
 * mobile: 2 colunas com a direita deslocada (grade escalonada do layout).
 */
const gridClass =
  'grid w-full grid-cols-2 gap-x-4 gap-y-6 max-md:[&>*:nth-child(even)]:pt-8 md:gap-x-[34px] md:gap-y-[72px] lg:grid-cols-3 [&>*]:min-w-0'

function MobileSearchBar({
  value,
  onSearch,
  onOpenFilters,
}: {
  value: string
  onSearch: (q: string) => void
  onOpenFilters: () => void
}) {
  const [text, setText] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => setText(value), [value])
  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <div className="flex h-[45px] gap-2">
      <form
        role="search"
        className="flex h-full flex-1 items-center gap-2 rounded-[10px] bg-card px-3"
        onSubmit={(e) => {
          e.preventDefault()
          clearTimeout(timer.current)
          onSearch(text.trim())
        }}
      >
        <FigmaIcon name="m-search" width={22} className="text-subtle" />
        <label htmlFor="m-search" className="sr-only">
          Buscar
        </label>
        <input
          id="m-search"
          type="search"
          autoComplete="off"
          placeholder="Explorar coleções"
          value={text}
          onChange={(e) => {
            const next = e.target.value
            setText(next)
            clearTimeout(timer.current)
            timer.current = setTimeout(() => onSearch(next.trim()), 350)
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold leading-4 text-foreground outline-none placeholder:font-bold"
        />
      </form>
      <button
        type="button"
        aria-label="Abrir filtros"
        onClick={onOpenFilters}
        className="grid size-[45px] shrink-0 place-items-center rounded-[14px] bg-[linear-gradient(137deg,rgba(210,138,76,0.45)_24.6%,#d28a4c_100%)] text-primary-foreground"
      >
        <FigmaIcon name="m-filter" width={16} height={16} />
      </button>
    </div>
  )
}
