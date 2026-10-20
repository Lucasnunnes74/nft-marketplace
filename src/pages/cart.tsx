import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useState } from 'react'
import type { CartItem, Quote } from '@/api/contracts'
import { Breadcrumb, EmptyState, ErrorState } from '@/components/common/states'
import { MobileScreenHeader } from '@/components/layout/mobile-nav'
import { QuoteTotals } from '@/components/nft/order-summary'
import { Price } from '@/components/nft/price'
import { QuantityStepper } from '@/components/nft/quantity-stepper'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FigmaIcon } from '@/components/ui/figma-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { useCart, useQuote, useRemoveCartItem, useSetCartQuantity } from '@/hooks/use-api'
import { useIsDesktop } from '@/hooks/use-media'
import { usePageTitle } from '@/hooks/use-page'
import { mulEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { couponStore, setCoupon } from '@/stores/coupon'
import { dismissNotice, marketNotices } from '@/stores/market-notices'

const issueText = {
  sold_out: 'Esgotado',
  insufficient_stock: 'Estoque insuficiente para a quantidade escolhida',
  quantity_limit: 'Acima do limite por pedido',
} as const

const editionLabel = (edition: number) => (edition >= 100 ? 'Aberta' : `1/${edition}`)

export function CartPage() {
  usePageTitle('Carrinho')
  const isDesktop = useIsDesktop()
  const cart = useCart()
  const coupon = couponStore.use()
  const items = cart.data?.items ?? []
  const quote = useQuote({ coupon, network: 'ethereum', enabled: items.length > 0 })
  const setQty = useSetCartQuantity()
  const remove = useRemoveCartItem()
  const notices = marketNotices.use()
  const relevantNotices = notices.filter((n) => items.some((i) => i.nftId === n.nftId))

  const header = isDesktop ? (
    <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/', hash: 'catalogo' }, { label: 'Carrinho' }]} />
  ) : (
    <MobileScreenHeader title="Carrinho de NFTs" />
  )

  if (cart.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy aria-label="Carregando carrinho">
        {header}
        <Skeleton className="h-[70px] w-full bg-card md:max-w-[782px]" />
        <Skeleton className="h-[70px] w-full bg-card md:max-w-[782px]" />
      </div>
    )
  }
  if (cart.isError) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <ErrorState error={cart.error} onRetry={() => void cart.refetch()} retrying={cart.isFetching} />
      </div>
    )
  }

  const issueFor = (item: CartItem) => quote.data?.items.find((q) => q.nftId === item.nftId)
  const onQty = (item: CartItem, q: number) => setQty.mutate({ nftId: item.nftId, quantity: q })
  const onRemove = (item: CartItem) => remove.mutate(item.nftId)

  return (
    <div className="flex flex-col gap-3">
      {header}
      {isDesktop ? <h1 className="sr-only">Carrinho</h1> : null}

      {items.length === 0 ? (
        <EmptyState
          icon={<FigmaIcon name="icon-cart" width={40} />}
          title="Seu carrinho está vazio"
          description="Explore o catálogo e adicione NFTs para continuar."
          action={
            <Button asChild>
              <Link to="/" search={{}}>
                Explorar NFTs
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-10">
          <section aria-label="Itens do carrinho" className="flex min-w-0 flex-col gap-3 md:w-[782px]">
            {relevantNotices.map((n) => (
              <Alert
                key={n.id}
                variant="warning"
                title={n.kind === 'price' ? `O preço de ${n.name} mudou` : `O estoque de ${n.name} mudou`}
                data-testid="market-notice"
              >
                <div className="flex items-start justify-between gap-3">
                  <span>
                    {n.kind === 'price' ? 'De' : 'Antes:'} {n.from} {n.kind === 'price' ? 'para' : '→'} {n.to}. O total foi recalculado.
                  </span>
                  <button type="button" aria-label="Dispensar aviso" onClick={() => dismissNotice(n.id)}>
                    <X className="size-4" />
                  </button>
                </div>
              </Alert>
            ))}

            {isDesktop ? (
              <table className="w-full border-separate border-spacing-y-3 text-left">
                <caption className="sr-only">Itens do carrinho</caption>
                <thead>
                  <tr className="text-base leading-4 text-foreground">
                    <th scope="col" className="w-[250px] pb-3 font-bold">
                      NFTs
                    </th>
                    <th scope="col" className="w-[77px] pb-3 font-medium">
                      Preço
                    </th>
                    <th scope="col" className="w-[120px] pb-3 text-center font-bold">
                      Edições
                    </th>
                    <th scope="col" className="w-[87px] pb-3 font-medium">
                      Total
                    </th>
                    <th scope="col" className="w-12 pb-3">
                      <span className="sr-only">Remover</span>
                    </th>
                  </tr>
                  <tr aria-hidden>
                    <td colSpan={5} className="p-0">
                      <div className="k-hairline" />
                    </td>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const issue = issueFor(item)
                    return (
                      <tr key={item.nftId} className="h-[70px] bg-card" data-testid="cart-item">
                        <td className="p-0">
                          <div className="flex items-center gap-4">
                            <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="shrink-0">
                              <img src={item.image} alt="" width={70} height={70} className="size-[70px] rounded-[6px] object-cover" />
                            </Link>
                            <div className="flex min-w-0 flex-col gap-1.5 leading-4">
                              <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="truncate text-base font-bold text-foreground hover:text-accent">
                                {item.name}
                              </Link>
                              <span className="text-sm text-subtle">ID do token: #{item.tokenId}</span>
                              <IssueText issue={issue} />
                            </div>
                          </div>
                        </td>
                        <td className="text-base font-bold leading-4 text-muted-foreground">
                          <Price value={item.unitPrice} />
                        </td>
                        <td className="text-center">
                          <QuantityStepper
                            label={`Quantidade de ${item.name}`}
                            value={item.quantity}
                            max={Math.max(item.maxQuantity, 1)}
                            disabled={item.available === 0}
                            onChange={(q) => onQty(item, q)}
                          />
                        </td>
                        <td className="text-base font-bold leading-4 text-accent" data-testid="line-total">
                          <Price value={mulEth(item.unitPrice, item.quantity)} />
                        </td>
                        <td className="pr-6 text-right">
                          <button
                            type="button"
                            aria-label={`Remover ${item.name}`}
                            onClick={() => onRemove(item)}
                            className="grid size-6 place-items-center text-subtle hover:text-coral"
                          >
                            <FigmaIcon name="icon-delete" width={18} height={20} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <ul className="flex flex-col gap-5">
                {items.map((item) => (
                  <li
                    key={item.nftId}
                    data-testid="cart-item"
                    className="relative flex min-h-[100px] overflow-hidden rounded-[14px] bg-card shadow-[0_6px_20px_rgba(10,6,4,0.45)]"
                  >
                    <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="shrink-0">
                      <img src={item.image} alt="" width={100} height={100} className="size-[100px] object-cover" />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col justify-between py-3 pl-[9px] pr-2">
                      <div className="flex flex-col gap-1.5 leading-4">
                        <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="truncate pr-6 text-[15px] font-bold text-foreground">
                          {item.name}
                        </Link>
                        <span className="text-sm text-muted-foreground">Edição: {editionLabel(item.edition)}</span>
                        <IssueText issue={issueFor(item)} />
                      </div>
                      <p className="text-lg font-bold leading-4 text-accent" data-testid="line-total">
                        <Price value={mulEth(item.unitPrice, item.quantity)} />
                      </p>
                    </div>
                    <QuantityStepper
                      variant="outline"
                      className="mr-4 self-center"
                      label={`Quantidade de ${item.name}`}
                      value={item.quantity}
                      max={Math.max(item.maxQuantity, 1)}
                      disabled={item.available === 0}
                      onChange={(q) => onQty(item, q)}
                    />
                    <button
                      type="button"
                      aria-label={`Remover ${item.name}`}
                      onClick={() => onRemove(item)}
                      className="absolute right-2 top-2 grid size-6 place-items-center text-subtle"
                    >
                      <FigmaIcon name="icon-delete" width={14} height={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <CartSummary quote={quote} isDesktop={isDesktop} />
        </div>
      )}
    </div>
  )
}

function IssueText({ issue }: { issue: Quote['items'][number] | undefined }) {
  if (!issue || issue.ok || !issue.issue) return null
  return (
    <span role="alert" className="text-xs font-bold text-coral">
      {issueText[issue.issue]}
      {issue.issue !== 'sold_out' ? ` (disponíveis: ${issue.available})` : ''}
    </span>
  )
}

function CartSummary({ quote, isDesktop }: { quote: ReturnType<typeof useQuote>; isDesktop: boolean }) {
  const coupon = couponStore.use()
  const [couponInput, setCouponInput] = useState('')
  const hasIssues = quote.data?.hasIssues ?? false

  return (
    <aside
      aria-label="Resumo da carteira"
      className="-mx-6 flex flex-col gap-6 rounded-t-[40px] bg-card px-6 pb-9 pt-6 md:sticky md:top-6 md:mx-0 md:w-[332px] md:shrink-0 md:rounded-none md:bg-transparent md:p-0"
    >
      <div className="hidden flex-col gap-3 md:flex">
        <h2 className="text-lg font-bold leading-4 text-foreground">Resumo da carteira</h2>
        <div className="k-hairline" />
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setCoupon(couponInput)
          setCouponInput('')
        }}
      >
        <label htmlFor="coupon" className={cn('text-sm font-bold leading-4 text-foreground', !isDesktop && 'sr-only')}>
          Código promocional
        </label>
        <div
          className={cn(
            'flex items-center overflow-hidden',
            isDesktop
              ? 'h-10 rounded-[3px] border border-primary pl-2'
              : 'h-[50px] rounded-[40px] border border-border pl-4 shadow-[0_6px_10px_rgba(10,6,4,0.45)]',
          )}
        >
          <input
            id="coupon"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
            placeholder={coupon || 'Digite o código promocional...'}
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-xs leading-4 text-foreground outline-none md:text-xs max-md:text-[13px]"
          />
          <button
            type="submit"
            disabled={!couponInput.trim()}
            className={cn(
              'flex h-full shrink-0 items-center justify-center text-[15px] font-bold leading-4 disabled:cursor-not-allowed',
              isDesktop
                ? 'w-[102px] bg-primary text-primary-foreground'
                : 'w-[97px] rounded-[40px] bg-[linear-gradient(96deg,rgba(210,138,76,0.54)_1%,#d28a4c_105%)] text-foreground',
            )}
          >
            Aplicar
          </button>
        </div>
        {quote.data?.coupon ? (
          <p
            role="status"
            data-testid="coupon-status"
            className={cn('text-xs', quote.data.coupon.status === 'applied' ? 'text-success' : 'text-coral')}
          >
            {quote.data.coupon.message}{' '}
            <button type="button" className="text-accent underline" onClick={() => setCoupon('')}>
              Remover
            </button>
          </p>
        ) : null}
      </form>

      {quote.isError ? (
        <ErrorState compact error={quote.error} onRetry={() => void quote.refetch()} retrying={quote.isFetching} title="Não foi possível calcular o total" />
      ) : quote.data ? (
        <QuoteTotals quote={quote.data} stale={quote.isFetching} />
      ) : (
        <div className="flex flex-col gap-3" aria-busy>
          <Skeleton className="h-4 w-full bg-surface-raised" />
          <Skeleton className="h-4 w-full bg-surface-raised" />
          <Skeleton className="h-4 w-full bg-surface-raised" />
          <Skeleton className="h-5 w-full bg-surface-raised" />
        </div>
      )}

      {hasIssues ? (
        <Alert variant="destructive" title="Ajuste seu carrinho">
          Remova ou reduza os itens indisponíveis para continuar.
        </Alert>
      ) : null}

      <div className="flex flex-col items-center gap-3">
        <Link
          to="/checkout"
          disabled={!quote.data || hasIssues}
          aria-disabled={!quote.data || hasIssues}
          className={cn(
            'flex w-full items-center justify-center text-[15px] font-bold leading-4 text-primary-foreground aria-disabled:pointer-events-none aria-disabled:opacity-50',
            isDesktop
              ? 'h-10 rounded-[3px] bg-primary hover:brightness-110'
              : 'h-[60px] rounded-[40px] bg-[linear-gradient(109deg,#d28a4c_4%,rgba(210,138,76,0.8)_122%)] text-base',
          )}
        >
          Conectar e finalizar
        </Link>
        <Link to="/" search={{}} hash="catalogo" className="text-[15px] leading-normal text-accent hover:underline">
          Continuar explorando
        </Link>
      </div>
    </aside>
  )
}
