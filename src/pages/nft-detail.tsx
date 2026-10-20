import { useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate, useRouter } from '@tanstack/react-router'
import { useId, useState } from 'react'
import { chainLabels, type NftDetail } from '@/api/contracts'
import { ApiError, toApiError } from '@/api/errors'
import { Breadcrumb, ErrorState, NotFoundState } from '@/components/common/states'
import { LiveIndicator } from '@/components/layout/footer'
import { FavoriteButton } from '@/components/nft/favorite-button'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { Price } from '@/components/nft/price'
import { QuantityStepper } from '@/components/nft/quantity-stepper'
import { Alert } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { FigmaIcon } from '@/components/ui/figma-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { useAddToCart, useCart, useNft, useNftList } from '@/hooks/use-api'
import { useIsDesktop } from '@/hooks/use-media'
import { usePageTitle } from '@/hooks/use-page'
import { cn } from '@/lib/utils'
import { toast } from '@/stores/toasts'

const route = getRouteApi('/nft/$nftId')

export function NftDetailPage() {
  const { nftId } = route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isDesktop = useIsDesktop()
  const nft = useNft(nftId)
  const cart = useCart()
  const add = useAddToCart()
  const [requested, setRequested] = useState(1)
  usePageTitle(nft.data?.name ?? 'NFT')

  const data = nft.data
  const inCart = cart.data?.items.find((i) => i.nftId === nftId)?.quantity ?? 0
  // Limite = menor entre estoque e máximo por pedido, descontando o que já está no carrinho.
  const maxAdd = data ? Math.max(0, Math.min(data.available, data.maxPerOrder) - inCart) : 0
  // Se o estoque cair em tempo real, a quantidade escolhida acompanha o novo limite (derivado no render).
  const quantity = Math.min(Math.max(1, requested), Math.max(1, maxAdd))

  async function addToCart(goToCart: boolean) {
    try {
      await add.mutateAsync({ nftId, quantity })
      if (goToCart) {
        void navigate({ to: '/cart' })
        return
      }
      toast({ title: 'Adicionado ao carrinho', description: `${quantity} × ${data?.name}`, variant: 'success' })
    } catch (e) {
      const err = toApiError(e)
      toast({ title: 'Não foi possível adicionar', description: err.message, variant: 'warning' })
      // Estoque/limite mudou: atualiza a tela com os dados reais.
      void qc.invalidateQueries({ queryKey: ['nfts', 'detail', nftId] })
    }
  }

  if (nft.isPending) return <DetailSkeleton />
  if (nft.isError) {
    if (nft.error instanceof ApiError && nft.error.code === 'NOT_FOUND') {
      return <NotFoundState title="NFT não encontrado" description="Este NFT não existe ou foi removido do catálogo." />
    }
    return <ErrorState error={nft.error} onRetry={() => void nft.refetch()} retrying={nft.isFetching} />
  }
  const n = nft.data
  const purchase = {
    quantity,
    maxAdd,
    inCart,
    pending: add.isPending,
    onQuantity: setRequested,
    onBuy: () => void addToCart(true),
    onAdd: () => void addToCart(false),
  }

  return isDesktop ? <DesktopDetail n={n} purchase={purchase} /> : <MobileDetail n={n} purchase={purchase} />
}

type Purchase = {
  quantity: number
  maxAdd: number
  inCart: number
  pending: boolean
  onQuantity: (q: number) => void
  onBuy: () => void
  onAdd: () => void
}

function DesktopDetail({ n, purchase }: { n: NftDetail; purchase: Purchase }) {
  const [image, setImage] = useState(1)
  const [zoom, setZoom] = useState(false)
  const soldOut = n.available === 0

  return (
    <div className="flex flex-col gap-24">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/', hash: 'catalogo' }]} />
        <div className="flex flex-col gap-8 lg:flex-row">
          <section aria-label="Galeria" className="flex h-[448px] shrink-0 items-center gap-7">
            <ul className="flex w-[100px] flex-col gap-4">
              {n.images.map((src, i) => (
                <li key={`${src}-${i}`} className="rounded-[6px] bg-card">
                  <button
                    type="button"
                    onClick={() => setImage(i)}
                    aria-label={`Ver imagem ${i + 1} de ${n.images.length}`}
                    aria-current={i === image}
                    className={cn(
                      'block size-[100px] overflow-hidden rounded-[8px] border',
                      i === image ? 'border-primary' : 'border-transparent opacity-80 hover:opacity-100',
                    )}
                  >
                    <img src={src} alt="" width={100} height={100} className="size-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="relative grid size-[444px] place-items-center rounded-[6px] bg-card p-4">
              <img
                src={n.images[image]}
                alt={`${n.name}, imagem ${image + 1} de ${n.images.length}`}
                width={404}
                height={404}
                fetchPriority="high"
                className="size-[404px] rounded-3xl object-cover"
              />
              <button
                type="button"
                aria-label="Ampliar imagem"
                onClick={() => setZoom(true)}
                className="absolute right-3 top-[15px] grid size-[30px] place-items-center rounded-full"
              >
                <FigmaIcon name="icon-zoom" width={30} original />
              </button>
            </div>
          </section>

          <section aria-label="Informações" className="flex min-w-0 flex-1 flex-col justify-between gap-5">
            <div className="flex flex-col gap-3">
              <h1 className="text-[28px] font-bold leading-normal text-foreground">{n.name}</h1>
              <div className="flex items-center justify-between gap-4">
                <p className="text-[22px] font-bold leading-4 text-accent" data-testid="detail-price">
                  <Price value={n.price} />
                  {n.previousPrice ? (
                    <span className="ml-3 text-lg font-normal text-subtle">
                      <span className="sr-only">Preço anterior: </span>
                      <Price value={n.previousPrice} className="font-normal" />
                    </span>
                  ) : null}
                </p>
                <Rating rating={n.rating} count={n.reviewCount} />
              </div>
              <div className="k-hairline mt-0" />
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-[15px] font-bold leading-4 text-foreground">Sobre este NFT:</h2>
              <p className="text-sm leading-6 text-muted-foreground">{n.summary}</p>
            </div>

            <EditionPills edition={n.edition} />

            {soldOut ? (
              <div className="flex items-center justify-between gap-4">
                <Alert variant="warning" title="Esta edição está esgotada" className="flex-1 py-3">
                  Favorite para acompanhar novas edições.
                </Alert>
                <FavoriteButton nftId={n.id} name={n.name} isFavorite={n.isFavorite} />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <QuantityStepper
                    variant="round"
                    label="Quantidade a comprar"
                    value={purchase.quantity}
                    max={Math.max(1, purchase.maxAdd)}
                    onChange={purchase.onQuantity}
                    disabled={purchase.maxAdd === 0}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={purchase.maxAdd === 0 || purchase.pending}
                      onClick={purchase.onBuy}
                      className="flex h-10 w-[130px] items-center justify-center rounded-[6px] bg-primary text-sm font-bold leading-5 text-primary-foreground hover:brightness-110 disabled:opacity-50"
                    >
                      {purchase.pending ? 'ADICIONANDO…' : 'COMPRAR'}
                    </button>
                    <FavoriteButton nftId={n.id} name={n.name} isFavorite={n.isFavorite} />
                  </div>
                </div>
                <PurchaseNotes purchase={purchase} maxPerOrder={n.maxPerOrder} />
              </div>
            )}

            <div className="flex flex-col gap-3">
              <TokenInfo n={n} />
              <ShareRow name={n.name} />
            </div>
          </section>
        </div>
      </div>

      <DescriptionTabs n={n} />
      <RelatedProducts n={n} />

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-[min(90vw,760px)] p-4">
          <DialogTitle className="sr-only">{n.name}</DialogTitle>
          <img src={n.images[image]} alt={n.name} className="w-full rounded-3xl object-cover" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MobileDetail({ n, purchase }: { n: NftDetail; purchase: Purchase }) {
  const router = useRouter()
  const soldOut = n.available === 0
  return (
    <div className="-mx-6 flex flex-col pb-[180px]">
      <div className="relative h-[506px] bg-[linear-gradient(137.6deg,#241612_12%,#2f1d15_106.6%)] px-7 pt-[23px]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => (window.history.length > 1 ? router.history.back() : void router.navigate({ to: '/' }))}
            className="grid size-[35px] place-items-center rounded-full border border-border bg-surface-raised text-accent"
          >
            <FigmaIcon name="m-arrow-left" width={11} height={6} className="rotate-90" />
          </button>
          <LiveIndicator />
          <FavoriteButton nftId={n.id} name={n.name} isFavorite={n.isFavorite} variant="chip-lg" />
        </div>
        <img
          src={n.images[0]}
          alt={n.name}
          width={361}
          height={356}
          fetchPriority="high"
          className="mt-2 h-[356px] w-full rounded-3xl object-cover"
        />
      </div>

      <section aria-label="Informações" className="relative -mt-[114px] flex flex-col gap-3 rounded-t-[31px] bg-card px-6 pb-6 pt-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold leading-6 text-foreground">{n.name}</h1>
          <p
            className="flex h-[27px] shrink-0 items-center gap-1 rounded-[32px] border border-primary px-1.5 text-sm leading-4"
            role="img"
            aria-label={`Nota ${n.rating.toLocaleString('pt-BR')} de 5, ${n.reviewCount} avaliações`}
          >
            <FigmaIcon name="m-star" width={12} height={11} className="text-warning" />
            <span aria-hidden className="font-medium text-foreground">
              {n.rating.toLocaleString('pt-BR')}
            </span>
            <span aria-hidden className="text-muted-foreground">
              ({n.reviewCount})
            </span>
          </p>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{n.summary}</p>
        <EditionPills edition={n.edition} gap="gap-3" />
        <TokenInfo n={n} />
        {soldOut ? (
          <Alert variant="warning" title="Esta edição está esgotada">
            Favorite para acompanhar novas edições.
          </Alert>
        ) : (
          <PurchaseNotes purchase={purchase} maxPerOrder={n.maxPerOrder} />
        )}
      </section>

      <div className="px-6 pt-10">
        <DescriptionTabs n={n} />
      </div>
      <div className="px-6 pt-10">
        <RelatedProducts n={n} />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-[40px] bg-card px-6 pb-9 pt-5 shadow-[0_0_10px_rgba(10,6,4,0.45)]">
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-medium leading-4 text-muted-foreground">Qtd.</span>
              <QuantityStepper
                variant="pill"
                label="Quantidade a comprar"
                value={purchase.quantity}
                max={Math.max(1, purchase.maxAdd)}
                onChange={purchase.onQuantity}
                disabled={soldOut || purchase.maxAdd === 0}
              />
            </div>
            <p className="text-xl font-bold leading-4 text-accent" data-testid="detail-price">
              <Price value={n.price} />
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={soldOut || purchase.maxAdd === 0 || purchase.pending}
              onClick={purchase.onBuy}
              className="flex h-[60px] flex-1 items-center justify-center rounded-[40px] bg-[linear-gradient(100deg,#d28a4c_4%,rgba(210,138,76,0.8)_122%)] text-base font-bold leading-5 text-primary-foreground disabled:opacity-50"
            >
              {soldOut ? 'Esgotado' : purchase.pending ? 'Adicionando…' : 'Comprar NFT'}
            </button>
            <button
              type="button"
              aria-label="Adicionar ao carrinho"
              disabled={soldOut || purchase.maxAdd === 0 || purchase.pending}
              onClick={purchase.onAdd}
              className="grid size-[60px] shrink-0 place-items-center rounded-[40px] border border-border bg-surface-raised text-subtle disabled:opacity-50"
            >
              <FigmaIcon name="m-shop" width={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PurchaseNotes({ purchase, maxPerOrder }: { purchase: Purchase; maxPerOrder: number }) {
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span>Máximo de {maxPerOrder} por pedido.</span>
      {purchase.inCart > 0 ? <span data-testid="in-cart-note">Você já tem {purchase.inCart} no carrinho.</span> : null}
      {purchase.maxAdd === 0 ? <span className="text-accent">Você já tem a quantidade máxima disponível no carrinho.</span> : null}
    </div>
  )
}

function Rating({ rating, count }: { rating: number; count: number }) {
  const filled = Math.floor(rating)
  return (
    <p className="flex items-center gap-1" role="img" aria-label={`Nota ${rating.toLocaleString('pt-BR')} de 5, ${count} avaliações de colecionadores`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} aria-hidden className="grid size-[15px] place-items-center">
          <FigmaIcon name={i < filled ? 'icon-star' : 'icon-star-empty'} width={12.5} height={11.9} original />
        </span>
      ))}
      <span aria-hidden className="ml-px text-[15px] leading-normal text-foreground">
        {count} avaliações de colecionadores
      </span>
    </p>
  )
}

/** Pílulas "Edição": 1/1, 1/10, 1/50 e ABERTA; a edição do NFT fica destacada (borda e cor). */
function EditionPills({ edition, gap = 'gap-1.5' }: { edition: number; gap?: string }) {
  const options = [
    { key: 1, label: '1/1' },
    { key: 10, label: '1/10' },
    { key: 50, label: '1/50' },
    { key: 100, label: 'ABERTA' },
  ]
  const current = edition >= 100 ? 100 : edition
  return (
    <div className="flex flex-col gap-2 md:gap-3">
      <h2 className="text-[15px] font-bold leading-4 text-foreground">Edição:</h2>
      <ul className={cn('flex items-center', gap)} aria-label="Tamanho da edição">
        {options.map((o) => {
          const active = o.key === current
          return (
            <li
              key={o.key}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex h-7 items-center justify-center rounded-full border-2 px-1.5 text-sm leading-4',
                o.key === 100 && 'px-2',
                active ? 'border-primary font-medium text-accent' : 'border-border text-muted-foreground',
              )}
            >
              {o.label}
              {active ? <span className="sr-only"> (edição deste NFT)</span> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TokenInfo({ n }: { n: NftDetail }) {
  const soldOut = n.available === 0
  return (
    <dl className="flex flex-col gap-3 text-[15px] leading-normal text-subtle">
      <div className="flex gap-1">
        <dt>ID do token:</dt>
        <dd>#{n.tokenId}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Coleção:</dt>
        <dd>{n.collection}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Atributos:</dt>
        <dd>{n.attributes.map((a) => a.value).join(', ')}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Disponíveis:</dt>
        <dd data-testid="detail-availability">
          {soldOut ? <span className="font-bold text-coral">Esgotado</span> : `${n.available} de ${n.edition}`}
        </dd>
      </div>
    </dl>
  )
}

function ShareRow({ name }: { name: string }) {
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const text = `${name} na Kurio`
  const links = [
    { label: 'Compartilhar no LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, icon: 'share-linkedin', w: 15, h: 14 },
    { label: 'Compartilhar por e-mail', href: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`, icon: 'icon-message', w: 18, h: 18 },
    { label: 'Compartilhar no X (Twitter)', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, icon: 'share-twitter', w: 16, h: 12 },
  ]
  return (
    <div className="flex items-center gap-2">
      <p className="text-[15px] font-bold leading-4 text-foreground">Compartilhar este NFT:</p>
      {links.map((l) => (
        <a key={l.icon} href={l.href} target="_blank" rel="noopener noreferrer" aria-label={l.label} className="grid place-items-center text-foreground hover:opacity-80">
          <FigmaIcon name={l.icon} width={l.w} height={l.h} original />
        </a>
      ))}
    </div>
  )
}

function DescriptionTabs({ n }: { n: NftDetail }) {
  const [tab, setTab] = useState<'details' | 'reviews'>('details')
  const id = useId()
  const tabs = [
    { key: 'details' as const, label: 'Detalhes do NFT' },
    { key: 'reviews' as const, label: `Avaliações de colecionadores (${n.reviewCount})` },
  ]
  const chain = chainLabels[n.chain]
  return (
    <section aria-label="Descrição" className="flex flex-col gap-3">
      <div className="flex flex-col">
        <div role="tablist" aria-label="Descrição do NFT" className="flex gap-8 overflow-x-auto">
          {tabs.map((t) => {
            const active = t.key === tab
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`${id}-${t.key}`}
                aria-selected={active}
                aria-controls={`${id}-${t.key}-panel`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(t.key)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    const next = tab === 'details' ? 'reviews' : 'details'
                    setTab(next)
                    document.getElementById(`${id}-${next}`)?.focus()
                  }
                }}
                className={cn(
                  'flex shrink-0 flex-col gap-3 whitespace-nowrap text-[17px] leading-4',
                  active ? 'font-bold text-accent' : 'text-foreground hover:text-accent',
                )}
              >
                {t.label}
                <span aria-hidden className={cn('h-[3px] w-full', active ? 'bg-primary' : 'bg-transparent')} />
              </button>
            )
          })}
        </div>
        <div className="k-hairline" />
      </div>

      {tab === 'details' ? (
        <div role="tabpanel" id={`${id}-details-panel`} aria-labelledby={`${id}-details`} className="flex flex-col gap-3 text-sm leading-6">
          {n.description.split('\n\n').map((p) => (
            <p key={p.slice(0, 24)} className="text-muted-foreground">
              {p}
            </p>
          ))}
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="font-bold text-foreground">Rede:</dt>
              <dd className="text-muted-foreground">Cunhado na {chain} com procedência imutável e metadados armazenados no IPFS.</dd>
            </div>
            <div>
              <dt className="font-bold text-foreground">Contrato:</dt>
              <dd className="text-muted-foreground">{n.contractAddress} • Contrato inteligente ERC-721 verificado.</dd>
            </div>
            <div>
              <dt className="font-bold text-foreground">Direitos autorais:</dt>
              <dd className="text-muted-foreground">
                Direitos autorais do criador: {n.royaltyBps / 100}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <div role="tabpanel" id={`${id}-reviews-panel`} aria-labelledby={`${id}-reviews`} className="flex flex-col gap-3 text-sm leading-6">
          <Rating rating={n.rating} count={n.reviewCount} />
          <p className="text-muted-foreground">
            Nota média {n.rating.toLocaleString('pt-BR')} de 5, com base em {n.reviewCount} avaliações de colecionadores verificados.
          </p>
        </div>
      )}
    </section>
  )
}

const RELATED_PER_PAGE = 5

/** "Mais desta coleção": itens da mesma coleção, em páginas de 5 (pontos do carrossel). */
function RelatedProducts({ n }: { n: NftDetail }) {
  const related = useNftList({ q: n.collection, sort: 'newest', pageSize: 16, page: 1 })
  const [page, setPage] = useState(0)
  const items = (related.data?.items ?? []).filter((i) => i.id !== n.id && i.collection === n.collection)
  const pages = Math.max(1, Math.ceil(items.length / RELATED_PER_PAGE))
  const current = Math.min(page, pages - 1)
  const visible = items.slice(current * RELATED_PER_PAGE, current * RELATED_PER_PAGE + RELATED_PER_PAGE)

  return (
    <section aria-labelledby="related-title" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 id="related-title" className="text-[17px] font-bold leading-4 text-accent">
          Mais desta coleção
        </h2>
        <div className="k-hairline" />
      </div>
      {related.isError ? (
        <ErrorState compact error={related.error} onRetry={() => void related.refetch()} retrying={related.isFetching} />
      ) : (
        <div className="flex flex-col items-center gap-8">
          <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-5 md:gap-x-[26px]">
            {related.isPending
              ? Array.from({ length: RELATED_PER_PAGE }, (_, i) => (
                  <li key={i}>
                    <NftCardSkeleton size="related" />
                  </li>
                ))
              : visible.map((item) => (
                  <li key={item.id}>
                    <NftCard nft={item} size="related" />
                  </li>
                ))}
          </ul>
          {!related.isPending && items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há outros itens desta coleção.</p>
          ) : null}
          {pages > 1 ? (
            <div className="-my-1.5 flex items-center" role="group" aria-label="Páginas de itens relacionados">
              {Array.from({ length: pages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Itens relacionados, página ${i + 1} de ${pages}`}
                  aria-pressed={i === current}
                  onClick={() => setPage(i)}
                  className="grid size-6 place-items-center"
                >
                  <span aria-hidden className={cn('size-3 rounded-full border-[1.3px] border-primary', i === current && 'bg-primary')} />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}

/**
 * No desktop o esqueleto reproduz a altura da página carregada (breadcrumb, galeria, abas e "mais desta
 * coleção"); com um esqueleto curto o rodapé saltava para baixo quando os dados chegavam (CLS).
 */
function DetailSkeleton() {
  return (
    <div className="flex flex-col md:gap-24" aria-busy aria-label="Carregando NFT">
      <div className="flex flex-col gap-3">
        <Skeleton className="hidden h-5 w-48 bg-card md:block" />
        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          <div className="hidden flex-col gap-4 md:flex">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="size-[100px] bg-card" />
            ))}
          </div>
          <Skeleton className="aspect-square w-full bg-card md:size-[444px]" />
          <div className="flex flex-1 flex-col gap-4">
            <Skeleton className="h-8 w-2/3 bg-card" />
            <Skeleton className="h-6 w-1/3 bg-card" />
            <Skeleton className="h-24 w-full bg-card" />
            <Skeleton className="h-10 w-full bg-card" />
          </div>
        </div>
      </div>
      <Skeleton className="hidden h-[360px] w-full bg-card md:block" />
      <Skeleton className="hidden h-[496px] w-full bg-card md:block" />
    </div>
  )
}
