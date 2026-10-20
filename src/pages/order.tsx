import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { XCircle } from 'lucide-react'
import type * as React from 'react'
import { networkLabels, type Order, walletProviderLabels } from '@/api/contracts'
import { ApiError } from '@/api/errors'
import { ErrorState, NotFoundState, Spinner } from '@/components/common/states'
import { Price } from '@/components/nft/price'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { FigmaIcon } from '@/components/ui/figma-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrder } from '@/hooks/use-api'
import { usePageTitle } from '@/hooks/use-page'
import { cmpEth } from '@/lib/eth'
import { shortAddress } from '@/lib/format'
import { cn } from '@/lib/utils'

const route = getRouteApi('/orders/$orderId')

function shortTx(hash: string) {
  return hash.length > 12 ? `${hash.slice(0, 6).toUpperCase().replace('0X', '0x')}…${hash.slice(-4).toUpperCase()}` : hash
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d).replace('.', '')
  return `${d.getDate()} ${month.charAt(0).toUpperCase()}${month.slice(1)}, ${d.getFullYear()}`
}

/** Confirmação do pedido: modal do layout sobre a página. Fechar volta ao início. */
export function OrderPage() {
  const { orderId } = route.useParams()
  const navigate = useNavigate()
  const order = useOrder(orderId)
  usePageTitle(order.data ? `Pedido ${order.data.id}` : 'Pedido')

  return (
    <Dialog open onOpenChange={(open) => !open && void navigate({ to: '/', search: {} })}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[578px] gap-0 overflow-y-auto rounded-none border-0 bg-card p-0" aria-describedby={undefined}>
        {order.isPending ? (
          <div className="flex flex-col gap-4 p-10" aria-busy aria-label="Carregando pedido">
            <DialogTitle className="sr-only">Carregando pedido</DialogTitle>
            <Skeleton className="mx-auto size-20 rounded-full bg-surface-raised" />
            <Skeleton className="h-16 w-full bg-surface-raised" />
            <Skeleton className="h-48 w-full bg-surface-raised" />
          </div>
        ) : order.isError ? (
          <div className="p-8">
            <DialogTitle className="sr-only">Pedido</DialogTitle>
            {order.error instanceof ApiError && order.error.code === 'NOT_FOUND' ? (
              <NotFoundState title="Pedido não encontrado" description="Não localizamos este pedido na sua conta." />
            ) : (
              <ErrorState error={order.error} onRetry={() => void order.refetch()} retrying={order.isFetching} />
            )}
          </div>
        ) : (
          <Receipt o={order.data} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Receipt({ o }: { o: Order }) {
  const statusLabel = o.status === 'confirmed' ? 'Confirmado' : o.status === 'rejected' ? 'Recusado' : 'Pendente'
  return (
    <div className="flex flex-col">
      <header className="flex min-h-[156px] flex-col items-center justify-center gap-4 px-6 py-6">
        {o.status === 'confirmed' ? (
          <div className="flex flex-col items-center gap-4" data-testid="order-confirmed">
            <FigmaIcon name="thank-you" width={65} height={80} original />
            <DialogTitle className="text-center text-base font-bold leading-4 text-muted-foreground">Seus NFTs agora estão na sua carteira</DialogTitle>
          </div>
        ) : o.status === 'pending' ? (
          <div className="flex flex-col items-center gap-4" data-testid="order-pending">
            <span aria-hidden className="size-14 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <DialogTitle className="text-center text-base font-bold leading-4 text-muted-foreground">Aguardando confirmação do pagamento</DialogTitle>
            <DialogDescription className="text-center text-xs text-subtle">
              Isso costuma levar alguns segundos. Você pode recarregar a página sem perder o pedido.
            </DialogDescription>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3" data-testid="order-rejected">
            <XCircle aria-hidden className="size-14 text-coral" />
            <DialogTitle className="text-center text-base font-bold leading-4 text-foreground">Pagamento recusado</DialogTitle>
            <DialogDescription className="text-center text-sm text-muted-foreground">
              {o.failureReason ?? 'A carteira recusou o pagamento.'} Seus itens continuam no carrinho.
            </DialogDescription>
            <div className="flex flex-wrap justify-center gap-3 pt-1">
              <Link to="/checkout" className="flex h-10 items-center rounded-[5px] bg-primary px-4 text-sm font-bold text-primary-foreground hover:brightness-110">
                Tentar novamente
              </Link>
              <Link to="/cart" className="flex h-10 items-center rounded-[5px] border border-primary px-4 text-sm font-medium text-accent hover:bg-primary/10">
                Voltar ao carrinho
              </Link>
            </div>
          </div>
        )}
        <span className="sr-only" data-testid="order-status">
          {statusLabel}
        </span>
        <span className="sr-only">
          Pedido <span data-testid="order-id">{o.id}</span>
        </span>
      </header>

      <div className="h-px bg-primary" />
      <dl className="grid min-h-[65px] grid-cols-2 items-center gap-y-3 px-6 py-3 sm:flex sm:justify-between sm:px-9 sm:py-1">
        <Meta label="ID da transação" bold>
          {o.txHash ? (
            <span data-testid="order-tx" title={o.txHash}>
              {shortTx(o.txHash)}
            </span>
          ) : (
            <span title={o.id}>{o.id}</span>
          )}
        </Meta>
        <Divider />
        <Meta label="Data">{formatDate(o.createdAt)}</Meta>
        <Divider />
        <Meta label="Total">
          <span data-testid="order-total">
            <Price value={o.total} />
          </span>
        </Meta>
        <Divider />
        <Meta label="Carteira" bold>
          <span title={`${o.wallet.label} · ${shortAddress(o.wallet.address)}`}>{walletProviderLabels[o.wallet.provider]}</span>
        </Meta>
      </dl>
      <div className="h-px bg-primary" />

      <section aria-labelledby="tx-details" className="flex flex-col gap-3 px-6 pb-12 pt-5 sm:px-11">
        <h3 id="tx-details" className="text-[15px] font-bold leading-4 text-foreground">
          Detalhes da transação
        </h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-base leading-4 text-foreground">
            <span className="font-bold">NFTs</span>
            <span className="flex gap-12">
              <span className="font-bold">Edições</span>
              <span className="font-medium">Subtotal</span>
            </span>
          </div>
          <div className="k-hairline" />
        </div>
        <ul className="flex flex-col gap-3">
          {o.items.map((i) => (
            <li key={i.nftId} className="flex h-[70px] items-center justify-between gap-3 bg-card">
              <span className="flex min-w-0 items-center gap-3">
                <img src={i.image} alt="" width={70} height={70} className="size-[66px] shrink-0 rounded-[8px] object-cover sm:size-[70px]" />
                <span className="flex min-w-0 flex-col gap-1.5 leading-4">
                  <span className="truncate text-base font-bold text-foreground">{i.name}</span>
                  <span className="text-sm text-subtle">ID do token: #{i.tokenId}</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-6 text-right leading-4 sm:gap-12">
                <span className="text-sm text-muted-foreground">(x {i.quantity})</span>
                <span className="text-lg font-bold text-accent">
                  <Price value={i.lineTotal} />
                </span>
              </span>
            </li>
          ))}
        </ul>
        <dl className="ml-auto flex w-full max-w-[321px] flex-col gap-3">
          {cmpEth(o.discount, '0') > 0 ? (
            <div className="flex items-center justify-between text-[15px] text-success">
              <dt>Desconto{o.couponCode ? ` (${o.couponCode})` : ''}</dt>
              <dd>
                (-) <Price value={o.discount} />
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between text-foreground">
            <dt className="text-[15px] leading-normal">Taxa de rede</dt>
            <dd className="text-lg leading-4">
              <Price value={o.networkFee} />
            </dd>
          </div>
          <div className="flex items-center justify-between font-bold leading-4">
            <dt className="text-base text-foreground">Total</dt>
            <dd className="text-lg text-accent">
              <Price value={o.total} />
            </dd>
          </div>
        </dl>
        <div className="k-hairline" />
        <div className="flex flex-col items-center gap-6 pt-3">
          <p className="text-center text-sm leading-[22px] text-muted-foreground">
            {o.status === 'confirmed'
              ? `Transação confirmada na ${networkLabels[o.network]}. A propriedade foi transferida para sua carteira conectada e registrada na rede.`
              : o.status === 'pending'
                ? `Transação enviada para a ${networkLabels[o.network]}. Assim que for confirmada, a propriedade será transferida para a sua carteira.`
                : 'Nenhum valor foi cobrado e o estoque reservado foi devolvido.'}
          </p>
          {o.status === 'confirmed' && o.explorerUrl ? (
            <div className="flex flex-col items-center gap-2">
              <a
                href={o.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-[5px] bg-primary p-4 text-base font-bold leading-4 text-primary-foreground hover:brightness-110"
              >
                Ver no Etherscan
                <span className="sr-only"> (abre em nova aba; transação simulada)</span>
              </a>
              <p className="text-xs text-subtle">Ambiente de demonstração: a transação é simulada.</p>
            </div>
          ) : null}
          {o.status === 'confirmed' ? (
            <Link to="/" search={{}} hash="catalogo" className="text-[15px] text-accent hover:underline">
              Continuar explorando
            </Link>
          ) : o.status === 'pending' ? (
            <Spinner label="Confirmando na rede…" />
          ) : null}
        </div>
      </section>
      <div aria-hidden className="h-2.5 bg-primary" />
    </div>
  )
}

function Meta({ label, bold, children }: { label: string; bold?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col text-muted-foreground">
      <dt className={cn('text-sm leading-4', bold && 'font-bold')}>{label}</dt>
      <dd className="text-[15px] leading-normal">{children}</dd>
    </div>
  )
}

function Divider() {
  return <span aria-hidden className="hidden h-[31px] w-px bg-primary sm:block" />
}
