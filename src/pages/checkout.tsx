import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  ensLabelRule,
  type Network,
  networkLabels,
  networks,
  networkSchema,
  usernameRule,
  type Wallet,
  type WalletProvider,
  walletProviderLabels,
} from '@/api/contracts'
import { ApiError, toApiError } from '@/api/errors'
import { Breadcrumb, EmptyState, ErrorState } from '@/components/common/states'
import { WalletChip } from '@/components/layout/footer'
import { MobileScreenHeader } from '@/components/layout/mobile-nav'
import { QuoteTotals } from '@/components/nft/order-summary'
import { Price } from '@/components/nft/price'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FigmaIcon } from '@/components/ui/figma-icon'
import { EnsField, FormField, SelectField } from '@/components/ui/form-field'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCart,
  useConnectWallet,
  useCurrentUser,
  useDisconnectWallet,
  usePlaceOrder,
  useQuote,
  useWallets,
} from '@/hooks/use-api'
import { useIsDesktop } from '@/hooks/use-media'
import { usePageTitle } from '@/hooks/use-page'
import { formatEth, mulEth } from '@/lib/eth'
import { shortAddress } from '@/lib/format'
import { cn } from '@/lib/utils'
import { couponStore, setCoupon } from '@/stores/coupon'

const checkoutSchema = z
  .object({
    displayName: z.string().trim().min(2, 'Informe o nome de exibição'),
    username: usernameRule,
    profileName: z.string().trim().min(2, 'Informe o nome do perfil'),
    email: z.string().min(1, 'Informe o e-mail').pipe(z.email('E-mail inválido')),
    network: networkSchema,
    walletId: z.string().min(1, 'Selecione uma carteira'),
    useOther: z.boolean(),
    secondary: z.string().trim().max(80, 'Use no máximo 80 caracteres'),
    referralCode: z.string().trim().max(32, 'Use no máximo 32 caracteres'),
    ensName: ensLabelRule,
    note: z.string().trim().max(500, 'Use no máximo 500 caracteres'),
  })
  .refine((v) => !v.useOther || v.secondary.length > 0, {
    path: ['secondary'],
    message: 'Informe o ENS ou o endereço da outra carteira',
  })
type CheckoutForm = z.infer<typeof checkoutSchema>

type OrderIssue =
  | { kind: 'price'; from: string; to: string }
  | { kind: 'stock'; message: string }
  | { kind: 'wallet'; message: string }
  | { kind: 'timeout'; message: string }
  | { kind: 'generic'; message: string }

export function CheckoutPage() {
  usePageTitle('Pagamento')
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useCurrentUser()
  const wallets = useWallets()
  const cart = useCart()
  const coupon = couponStore.use()
  const [issue, setIssue] = useState<OrderIssue | null>(null)
  const [ack, setAck] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [provider, setProvider] = useState<WalletProvider | null>(null)
  const place = usePlaceOrder()
  const connect = useConnectWallet()
  const disconnect = useDisconnectWallet()

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      displayName: '',
      username: '',
      profileName: '',
      email: '',
      network: 'ethereum',
      walletId: '',
      useOther: false,
      secondary: '',
      referralCode: '',
      ensName: '',
      note: '',
    },
  })
  const { setValue, watch, setError, handleSubmit } = form
  const walletId = watch('walletId')
  const network = watch('network')
  const items = cart.data?.items ?? []
  const quote = useQuote({ coupon, network, enabled: items.length > 0 })

  // Preenche os dados do colecionador com o perfil assim que carrega.
  useEffect(() => {
    const u = user.data?.user
    if (!u) return
    setValue('displayName', u.name)
    setValue('profileName', u.name)
    setValue('username', u.username)
    setValue('email', u.email)
    setValue('ensName', u.ensName ?? '')
    setValue('referralCode', u.referralCode ?? '')
  }, [user.data, setValue])

  // Seleciona a carteira principal (e sua rede) quando as carteiras carregam.
  useEffect(() => {
    if (wallets.data && !walletId) {
      const primary = wallets.data.find((w) => w.isPrimary) ?? wallets.data[0]
      if (primary) selectWallet(primary)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets.data, walletId])

  const selected = wallets.data?.find((w) => w.id === walletId)
  const activeProvider = provider ?? selected?.provider ?? 'metamask'

  function selectWallet(w: Wallet) {
    setValue('walletId', w.id, { shouldValidate: form.formState.isSubmitted })
    setValue('network', w.network)
    setValue('secondary', w.ens ?? '')
    setProvider(null)
    setConnectError(null)
  }

  async function onConnect() {
    if (!selected) return
    setConnectError(null)
    try {
      await connect.mutateAsync({ id: selected.id, network })
    } catch (e) {
      setConnectError(toApiError(e).message)
    }
  }

  async function onConfirm(values: CheckoutForm) {
    if (place.isPending || !quote.data || !selected) return
    if (!selected.connected) {
      setError('walletId', { type: 'manual', message: 'Conecte a carteira para continuar' })
      return
    }
    if (quote.data.hasIssues) return
    const submittedTotal = quote.data.total
    setIssue(null)
    try {
      const order = await place.mutateAsync({
        walletId: selected.id,
        network,
        provider: activeProvider,
        couponCode: coupon || undefined,
        expectedTotal: submittedTotal,
        collector: {
          displayName: values.displayName,
          username: values.username,
          profileName: values.profileName,
          email: values.email,
          referralCode: values.referralCode || undefined,
          ensName: values.ensName || undefined,
          secondaryAddress: values.useOther ? values.secondary || undefined : undefined,
          note: values.note || undefined,
        },
      })
      void navigate({ to: '/orders/$orderId', params: { orderId: order.id }, replace: true })
    } catch (e) {
      const err = e instanceof ApiError ? e : toApiError(e)
      if (err.code === 'PRICE_CHANGED' || err.code === 'OUT_OF_STOCK' || err.code === 'QUANTITY_LIMIT') {
        // Mostra imediatamente o total/estoque reais antes de nova confirmação.
        void qc.invalidateQueries({ queryKey: ['quote'] })
        void qc.invalidateQueries({ queryKey: ['cart'] })
      }
      switch (err.code) {
        case 'PRICE_CHANGED': {
          const next = (err.details as { quote?: { total: string } } | undefined)?.quote?.total ?? submittedTotal
          setAck(false)
          setIssue({ kind: 'price', from: submittedTotal, to: next })
          break
        }
        case 'OUT_OF_STOCK':
        case 'QUANTITY_LIMIT':
          setIssue({ kind: 'stock', message: err.message })
          break
        case 'WALLET_DISCONNECTED':
          setIssue({ kind: 'wallet', message: err.message })
          break
        case 'TIMEOUT':
        case 'NETWORK':
          setIssue({
            kind: 'timeout',
            message: 'Não recebemos a confirmação do servidor. Tentamos novamente com segurança: seu pedido não será duplicado.',
          })
          break
        default:
          setIssue({ kind: 'generic', message: err.message })
      }
    }
  }

  const header = isDesktop ? (
    <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/', hash: 'catalogo' }, { label: 'Pagamento' }]} />
  ) : (
    <MobileScreenHeader title="Pagamento com carteira" />
  )

  if (cart.isPending || wallets.isPending) {
    return (
      <div className="flex flex-col gap-8" aria-busy aria-label="Carregando pagamento">
        {header}
        <Skeleton className="h-96 w-full bg-card" />
      </div>
    )
  }
  if (cart.isError || wallets.isError) {
    const failed = cart.isError ? cart : wallets
    return (
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState error={failed.error} onRetry={() => void failed.refetch()} retrying={failed.isFetching} />
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <EmptyState
          title="Não há itens para pagar"
          description="Seu carrinho está vazio. Adicione NFTs para concluir uma compra."
          action={
            <Button asChild>
              <Link to="/" search={{}}>
                Explorar NFTs
              </Link>
            </Button>
          }
        />
      </div>
    )
  }

  const priceNeedsAck = issue?.kind === 'price' && !ack
  const confirmDisabled = place.isPending || !quote.data || quote.isFetching || quote.data.hasIssues || priceNeedsAck
  const walletError = form.formState.errors.walletId?.message

  const connection = (
    <ConnectionStatus
      wallet={selected}
      connecting={connect.isPending}
      disconnecting={disconnect.isPending}
      error={connectError}
      onConnect={() => void onConnect()}
      onDisconnect={() => selected && disconnect.mutate(selected.id)}
    />
  )
  const issues = <IssueAlerts issue={issue} ack={ack} onAck={setAck} />
  const confirmButton = (
    <button
      type="submit"
      data-testid="confirm-order"
      disabled={confirmDisabled}
      className={cn(
        'flex w-full items-center justify-center text-[15px] font-bold leading-4 text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50',
        isDesktop
          ? 'h-[45px] rounded-[8px] bg-primary hover:brightness-110'
          : 'h-[60px] rounded-[40px] bg-[linear-gradient(108deg,#d28a4c_4%,rgba(210,138,76,0.8)_122%)]',
      )}
    >
      {place.isPending ? 'Processando…' : 'Confirmar compra'}
    </button>
  )
  const pendingNote = place.isPending ? (
    <p role="status" className="text-center text-sm text-muted-foreground">
      Enviando pedido com segurança. Não feche esta página.
    </p>
  ) : null

  return (
    <form className="flex flex-col gap-8" onSubmit={handleSubmit(onConfirm)} noValidate>
      {header}
      <h1 className="sr-only">Pagamento</h1>

      {isDesktop ? (
        <div className="flex items-start gap-8">
          <CollectorFields form={form} wallets={wallets.data} selected={selected} onSelectWallet={selectWallet} />

          <aside aria-label="Resumo do pedido" className="flex w-[405px] shrink-0 flex-col gap-3">
            <h2 className="text-[17px] font-bold leading-4 text-foreground">Seus NFTs</h2>
            <OrderItems />
            <CouponToggle />
            {quote.isError ? (
              <ErrorState compact error={quote.error} onRetry={() => void quote.refetch()} title="Não foi possível calcular o total" />
            ) : quote.data ? (
              <QuoteTotals quote={quote.data} stale={quote.isFetching} feeNoteAlign="center" totalDivider />
            ) : (
              <Skeleton className="h-28 w-full bg-card" />
            )}
            {quote.data?.hasIssues ? (
              <Alert variant="destructive" title="Há itens indisponíveis">
                <Link to="/cart" className="underline">
                  Ajuste o carrinho
                </Link>{' '}
                para continuar.
              </Alert>
            ) : null}
            <div className="flex flex-col gap-5 pt-2">
              <h2 className="text-center text-[17px] font-bold leading-4 text-foreground">Carteira e rede</h2>
              <ProviderOptions value={activeProvider} onChange={setProvider} />
              {connection}
              {issues}
              {confirmButton}
              {pendingNote}
            </div>
          </aside>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold leading-4 text-foreground">Carteira conectada</h2>
            <Link to="/wallets" className="text-sm font-bold leading-4 text-accent">
              Trocar carteira
            </Link>
          </div>
          {wallets.data.length === 0 ? (
            <NoWalletAlert />
          ) : (
            <fieldset className="flex flex-col gap-5">
              <legend className="sr-only">Carteira de destino</legend>
              {wallets.data.map((w) => {
                const active = w.id === walletId
                return (
                  <label
                    key={w.id}
                    className={cn(
                      'relative flex min-h-[93px] cursor-pointer items-start gap-5 rounded-[14px] bg-card py-[15px] pl-[19px] pr-6',
                      active && 'shadow-[0_20px_20px_rgba(10,6,4,0.45)]',
                    )}
                  >
                    <input type="radio" name="wallet" className="peer sr-only" checked={active} onChange={() => selectWallet(w)} />
                    <RadioDot checked={active} className="mt-[23px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring" />
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="text-base font-bold leading-4 text-foreground">{w.label}</span>
                      <span className="text-sm leading-[22px] text-muted-foreground">
                        {w.ens ?? shortAddress(w.address)}
                        <br />
                        {w.isPrimary ? `Rede principal ${networkLabels[w.network]}` : `Rede ${networkLabels[w.network]}`}
                      </span>
                    </span>
                    <FigmaIcon name="m-kebab" width={3} height={15} className="mt-6 text-subtle" />
                  </label>
                )
              })}
            </fieldset>
          )}
          {walletError ? (
            <p role="alert" className="text-xs text-coral">
              {walletError}
            </p>
          ) : null}
          {connection}
          <h2 className="pt-1 text-base font-bold leading-4 text-foreground">Carteira e rede</h2>
          <ProviderOptions value={activeProvider} onChange={setProvider} mobile />
          {quote.data ? (
            <p className="flex items-center justify-end gap-7 font-bold leading-4">
              <span className="text-base text-foreground">Total:</span>
              <span className="text-lg text-accent" data-testid="quote-total">
                <Price value={quote.data.total} />
              </span>
            </p>
          ) : (
            <Skeleton className="ml-auto h-5 w-40 bg-card" />
          )}
          {quote.data?.hasIssues ? (
            <Alert variant="destructive" title="Há itens indisponíveis">
              <Link to="/cart" className="underline">
                Ajuste o carrinho
              </Link>{' '}
              para continuar.
            </Alert>
          ) : null}
          {Object.keys(form.formState.errors).some((k) => k !== 'walletId') ? (
            <Alert variant="destructive" title="Complete seu perfil">
              Alguns dados do colecionador estão incompletos.{' '}
              <Link to="/profile" className="underline">
                Atualize o perfil
              </Link>
              .
            </Alert>
          ) : null}
          {issues}
          <div className="pt-6">{confirmButton}</div>
          {pendingNote}
        </div>
      )}
    </form>
  )
}

function CollectorFields({
  form,
  wallets,
  selected,
  onSelectWallet,
}: {
  form: ReturnType<typeof useForm<CheckoutForm>>
  wallets: Wallet[]
  selected: Wallet | undefined
  onSelectWallet: (w: Wallet) => void
}) {
  const { register, watch, formState } = form
  const errors = formState.errors
  const useOther = watch('useOther')
  const noteId = useId()

  return (
    <section aria-labelledby="collector-title" className="flex min-w-0 flex-1 flex-col gap-3">
      <h2 id="collector-title" className="text-[17px] font-bold leading-4 text-foreground">
        Perfil do colecionador
      </h2>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <FormField id="c-display" label="Nome de exibição" required error={errors.displayName?.message} {...register('displayName')} autoComplete="name" />
          <FormField id="c-username" label="Nome de usuário" required error={errors.username?.message} {...register('username')} autoComplete="username" />
          <SelectField id="c-network" label="Rede" required error={errors.network?.message} {...register('network')}>
            {networks.map((n) => (
              <option key={n} value={n}>
                {networkLabels[n as Network]}
              </option>
            ))}
          </SelectField>
          <FormField id="c-profile" label="Nome do perfil" required error={errors.profileName?.message} {...register('profileName')} />
          <FormField
            id="c-address"
            label="Endereço da carteira"
            required
            readOnly
            value={selected?.address ?? ''}
            placeholder="Endereço 0x da carteira"
            className="font-mono text-xs"
          />
          <FormField
            id="c-secondary"
            label="ENS ou carteira secundária (opcional)"
            hideLabel
            placeholder="ENS ou carteira secundária (opcional)"
            disabled={!useOther}
            error={errors.secondary?.message}
            {...register('secondary')}
          />
          {wallets.length === 0 ? (
            <div className="flex flex-col">
              <p className="k-label">
                Tipo de carteira<span className="k-required" aria-hidden>*</span>
              </p>
              <NoWalletAlert />
            </div>
          ) : (
            <SelectField
              id="c-wallet"
              label="Tipo de carteira"
              required
              error={errors.walletId?.message}
              {...register('walletId', {
                onChange: (e) => {
                  const w = wallets.find((x) => x.id === e.target.value)
                  if (w) onSelectWallet(w)
                },
              })}
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label} · {walletProviderLabels[w.provider]}
                </option>
              ))}
            </SelectField>
          )}
          <FormField id="c-referral" label="Código de indicação" error={errors.referralCode?.message} {...register('referralCode')} />
          <FormField id="c-email" label="E-mail" required type="email" error={errors.email?.message} {...register('email')} autoComplete="email" />
          <EnsField id="c-ens" error={errors.ensName?.message} {...register('ensName')} />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-[15px] leading-normal text-foreground">
          <input type="checkbox" className="peer sr-only" {...register('useOther')} />
          <RadioDot checked={useOther} small className="peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring" />
          Usar outra carteira?
        </label>

        <div className="flex w-[350px] max-w-full flex-col gap-3">
          <label htmlFor={noteId} className="text-[15px] leading-[15px] text-foreground">
            Observação do colecionador (opcional)
          </label>
          <textarea
            id={noteId}
            rows={6}
            aria-invalid={Boolean(errors.note)}
            className="h-[152px] resize-none rounded-[3px] border border-border bg-transparent p-3 text-sm text-foreground outline-none focus-visible:border-primary"
            {...register('note')}
          />
          {errors.note ? (
            <p role="alert" className="text-xs text-coral">
              {errors.note.message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function OrderItems() {
  const cart = useCart()
  const items = cart.data?.items ?? []
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-base leading-4 text-foreground">
          <span className="font-bold">NFTs</span>
          <span className="font-medium">Subtotal</span>
        </div>
        <div className="k-hairline" />
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((i) => (
          <li key={i.nftId} className="flex h-[70px] items-center gap-2 bg-card pl-1 pr-4">
            <img src={i.image} alt="" width={66} height={66} className="size-[66px] shrink-0 rounded-[8px] object-cover" />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5 leading-4">
              <span className="truncate text-base font-bold text-foreground">{i.name}</span>
              <span className="text-sm text-subtle">ID do token: #{i.tokenId}</span>
            </span>
            <span className="text-sm leading-4 text-muted-foreground">(x {i.quantity})</span>
            <span className="text-right text-lg font-bold leading-4 text-accent">
              <Price value={mulEth(i.unitPrice, i.quantity)} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}


function CouponToggle() {
  const coupon = couponStore.use()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const id = useId()
  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="text-sm leading-4 text-foreground hover:text-accent">
        {coupon ? `Código aplicado: ${coupon}` : 'Tem um código promocional? Aplique aqui'}
      </button>
      {open ? (
        <div className="flex h-10 w-full items-center overflow-hidden rounded-[3px] border border-primary pl-2">
          <label htmlFor={id} className="sr-only">
            Código promocional
          </label>
          <input
            id={id}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                setCoupon(value)
                setValue('')
              }
            }}
            placeholder="Digite o código promocional..."
            className="h-full min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none"
          />
          <button
            type="button"
            disabled={!value.trim()}
            onClick={() => {
              setCoupon(value)
              setValue('')
            }}
            className="h-full w-[102px] bg-primary text-[15px] font-bold text-primary-foreground disabled:opacity-60"
          >
            Aplicar
          </button>
        </div>
      ) : null}
    </div>
  )
}

const providerOrder: WalletProvider[] = ['walletconnect', 'metamask', 'coinbase']

/** "Carteira e rede": conector usado para assinar (WalletConnect, MetaMask, Coinbase Wallet). */
function ProviderOptions({ value, onChange, mobile }: { value: WalletProvider; onChange: (p: WalletProvider) => void; mobile?: boolean }) {
  return (
    <fieldset className={cn('flex flex-col', mobile ? 'gap-4' : 'gap-4')}>
      <legend className="sr-only">Conector da carteira</legend>
      {providerOrder.map((p) => {
        const checked = p === value
        return (
          <label
            key={p}
            className={cn(
              'flex cursor-pointer items-center gap-2.5',
              mobile
                ? 'h-[65px] rounded-[15px] bg-card pl-3.5 pr-4 shadow-[0_0_20px_rgba(10,6,4,0.45)]'
                : cn('h-[45px] rounded-[3px] border pl-3 pr-3', checked ? 'border-primary' : 'border-border'),
            )}
          >
            <input type="radio" name="provider" value={p} checked={checked} onChange={() => onChange(p)} className="peer sr-only" />
            {mobile ? (
              <>
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-surface-raised text-sm font-bold text-accent">
                  {p === 'coinbase' ? <FigmaIcon name="m-wallet" width={18} height={16} /> : p === 'walletconnect' ? 'W' : 'M'}
                </span>
                <span className="flex-1 text-sm leading-4 text-foreground">{walletProviderLabels[p]}</span>
                <RadioDot checked={checked} className="peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring" />
              </>
            ) : (
              <>
                <RadioDot checked={checked} className="peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring" />
                {p === 'walletconnect' ? (
                  <>
                    <WalletChip className="w-[224px]" />
                    <span className="sr-only">WalletConnect</span>
                  </>
                ) : (
                  <span className={cn('text-[15px] leading-normal text-foreground', p === 'coinbase' && 'pl-[13px]')}>{walletProviderLabels[p]}</span>
                )}
              </>
            )}
          </label>
        )
      })}
    </fieldset>
  )
}

/** Rádio do layout: anel 16px; marcado tem o ponto central (não depende só da cor). */
function RadioDot({ checked, small, className }: { checked: boolean; small?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full border-[1.2px]',
        small ? 'size-[15px]' : 'size-4',
        checked ? 'border-primary' : 'border-border-soft',
        className,
      )}
    >
      {checked ? <span className="size-2.5 rounded-full bg-primary" /> : null}
    </span>
  )
}

function ConnectionStatus({
  wallet,
  connecting,
  disconnecting,
  error,
  onConnect,
  onDisconnect,
}: {
  wallet: Wallet | undefined
  connecting: boolean
  disconnecting: boolean
  error: string | null
  onConnect: () => void
  onDisconnect: () => void
}) {
  if (!wallet) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-border bg-card px-3 py-2.5 text-sm">
        <span data-testid="wallet-status" role="status" className="flex items-center gap-2 text-muted-foreground">
          <span aria-hidden className={cn('size-2 rounded-full', wallet.connected ? 'bg-success' : 'bg-subtle')} />
          {wallet.connected ? `Carteira conectada (${wallet.label}).` : 'Conecte a carteira para autorizar o pagamento.'}
        </span>
        {wallet.connected ? (
          <Button type="button" size="sm" variant="outline" disabled={disconnecting} onClick={onDisconnect}>
            Desconectar
          </Button>
        ) : (
          <Button type="button" size="sm" disabled={connecting} onClick={onConnect}>
            {connecting ? 'Conectando…' : 'Conectar carteira'}
          </Button>
        )}
      </div>
      {error ? (
        <Alert variant="destructive" title="Conexão recusada" data-testid="connect-error">
          {error}
        </Alert>
      ) : null}
    </div>
  )
}

function IssueAlerts({ issue, ack, onAck }: { issue: OrderIssue | null; ack: boolean; onAck: (v: boolean) => void }) {
  if (!issue) return null
  switch (issue.kind) {
    case 'price':
      return (
        <Alert variant="warning" title="O total do pedido mudou" data-testid="price-changed">
          <p>
            O total passou de <strong>{formatEth(issue.from)}</strong> para <strong>{formatEth(issue.to)}</strong> enquanto você finalizava
            a compra. Nada foi cobrado.
          </p>
          <label className="mt-2 flex items-center gap-2 text-foreground">
            <input type="checkbox" className="accent-[var(--primary)]" checked={ack} onChange={(e) => onAck(e.target.checked)} />
            Estou ciente do novo total
          </label>
        </Alert>
      )
    case 'stock':
      return (
        <Alert variant="destructive" title="Item indisponível" data-testid="stock-issue">
          {issue.message}{' '}
          <Link to="/cart" className="underline">
            Ajustar carrinho
          </Link>
        </Alert>
      )
    case 'wallet':
      return (
        <Alert variant="destructive" title="Carteira desconectada">
          {issue.message}
        </Alert>
      )
    case 'timeout':
      return (
        <Alert variant="warning" title="Sem confirmação do servidor" data-testid="timeout-issue">
          {issue.message}
        </Alert>
      )
    default:
      return (
        <Alert variant="destructive" title="Não foi possível concluir">
          {issue.message}
        </Alert>
      )
  }
}

function NoWalletAlert() {
  return (
    <Alert variant="warning" title="Nenhuma carteira cadastrada">
      <Link to="/wallets" className="underline">
        Cadastre uma carteira
      </Link>{' '}
      para receber seus NFTs.
    </Alert>
  )
}
