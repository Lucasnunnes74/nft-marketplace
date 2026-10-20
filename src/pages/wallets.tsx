import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  ensLabelRule,
  type Network,
  networkLabels,
  networks,
  networkSchema,
  type User,
  usernameRule,
  type Wallet,
  type WalletBody,
  walletBodySchema,
  walletAddress,
  walletProviderLabels,
  walletProviders,
  walletProviderSchema,
} from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { AccountLayout } from '@/components/account/account-layout'
import { ErrorState } from '@/components/common/states'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { EnsField, FormField, SelectField } from '@/components/ui/form-field'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreateWallet, useCurrentUser, useUpdateProfile, useUpdateWallet, useWallets } from '@/hooks/use-api'
import { usePageTitle } from '@/hooks/use-page'
import { applyApiFieldErrors } from '@/lib/form'
import { shortAddress } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from '@/stores/toasts'

export function WalletsPage() {
  usePageTitle('Carteiras')
  const wallets = useWallets()
  const user = useCurrentUser()
  const [editing, setEditing] = useState<Wallet | 'new' | null>(null)

  const primary = wallets.data?.find((w) => w.isPrimary) ?? wallets.data?.[0]
  const secondary = wallets.data?.filter((w) => w.id !== primary?.id) ?? []

  return (
    <AccountLayout active="carteiras">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4 leading-4">
            <h2 className="text-[17px] font-bold text-foreground">Carteira principal</h2>
            <button type="button" onClick={() => setEditing('new')} className="text-base font-medium text-accent hover:underline">
              Adicionar
            </button>
          </div>
          <p className="text-sm leading-[15px] text-muted-foreground">
            Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.
          </p>
        </div>

        {wallets.isPending || user.isPending ? (
          <div className="grid gap-6 md:grid-cols-2" aria-busy aria-label="Carregando carteiras">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[69px] w-full bg-card" />
            ))}
          </div>
        ) : wallets.isError ? (
          <ErrorState error={wallets.error} onRetry={() => void wallets.refetch()} retrying={wallets.isFetching} />
        ) : user.isError ? (
          <ErrorState error={user.error} onRetry={() => void user.refetch()} retrying={user.isFetching} />
        ) : (
          <PrimaryWalletForm key={primary ? `${primary.id}-${primary.label}-${primary.address}` : 'new'} wallet={primary} user={user.data.user} />
        )}

        <section aria-labelledby="secondary-title" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id="secondary-title" className="text-[17px] font-bold leading-4 text-foreground">
              Carteira secundária
            </h2>
            <div className="flex items-center gap-6">
              <p className="flex items-center gap-2 text-sm leading-4 text-foreground">
                <span
                  aria-hidden
                  className={cn(
                    'grid size-4 place-items-center rounded-full border-[1.2px]',
                    secondary.length === 0 ? 'border-primary' : 'border-border-soft',
                  )}
                >
                  {secondary.length === 0 ? <span className="size-2.5 rounded-full bg-primary" /> : null}
                </span>
                Igual à carteira principal
                <span className="sr-only">{secondary.length === 0 ? ' (em uso)' : ' (não)'}</span>
              </p>
              <button type="button" onClick={() => setEditing('new')} className="text-base font-medium leading-4 text-accent hover:underline">
                Adicionar
              </button>
            </div>
          </div>
          {secondary.length === 0 ? (
            <p className="text-sm leading-[15px] text-muted-foreground">Você ainda não adicionou uma carteira secundária.</p>
          ) : (
            <ul className="flex flex-col gap-3" data-testid="wallet-list">
              {secondary.map((w) => (
                <SecondaryWallet key={w.id} wallet={w} onEdit={() => setEditing(w)} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          {editing !== null ? <WalletForm wallet={editing === 'new' ? null : editing} onDone={() => setEditing(null)} /> : null}
        </DialogContent>
      </Dialog>
    </AccountLayout>
  )
}

const primarySchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome de exibição'),
  label: z.string().trim().min(2, 'Dê um apelido à carteira'),
  network: networkSchema,
  username: usernameRule,
  address: walletAddress,
  ens: z.string().trim().max(80, 'Use no máximo 80 caracteres'),
  provider: walletProviderSchema,
  referralCode: z.string().trim().max(32, 'Use no máximo 32 caracteres'),
  email: z.string().min(1, 'Informe o e-mail').pipe(z.email('E-mail inválido')),
  ensName: ensLabelRule,
})
type PrimaryForm = z.infer<typeof primarySchema>

/** Formulário "Carteira principal": dados da carteira + dados do colecionador usados no pagamento. */
function PrimaryWalletForm({ wallet, user }: { wallet: Wallet | undefined; user: User }) {
  const create = useCreateWallet()
  const update = useUpdateWallet()
  const updateProfile = useUpdateProfile()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, dirtyFields },
  } = useForm<PrimaryForm>({
    resolver: zodResolver(primarySchema),
    defaultValues: {
      name: user.name,
      label: wallet?.label ?? '',
      network: wallet?.network ?? 'ethereum',
      username: user.username,
      address: wallet?.address ?? '',
      ens: wallet?.ens ?? '',
      provider: wallet?.provider ?? 'metamask',
      referralCode: user.referralCode ?? '',
      email: user.email,
      ensName: user.ensName ?? '',
    },
  })
  const pending = create.isPending || update.isPending || updateProfile.isPending

  async function onSubmit(v: PrimaryForm) {
    setFormError(null)
    try {
      const body: WalletBody = { label: v.label, address: v.address, network: v.network, provider: v.provider, ens: v.ens || null, isPrimary: true }
      if (wallet) await update.mutateAsync({ id: wallet.id, body })
      else await create.mutateAsync(body)
      if (dirtyFields.name || dirtyFields.username || dirtyFields.email || dirtyFields.ensName || dirtyFields.referralCode) {
        await updateProfile.mutateAsync({
          name: v.name,
          username: v.username,
          email: v.email,
          ensName: v.ensName || null,
          referralCode: v.referralCode || null,
        })
      }
      toast({ title: wallet ? 'Carteira atualizada' : 'Carteira cadastrada', variant: 'success' })
    } catch (e) {
      const known = ['label', 'address', 'network', 'provider', 'ens', 'name', 'username', 'email', 'ensName', 'referralCode']
      if (!applyApiFieldErrors(e, setError, known)) setFormError(toApiError(e).message)
    }
  }

  return (
    <form className="flex flex-col gap-8" onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError ? <Alert variant="destructive">{formError}</Alert> : null}
      {!wallet ? <Alert variant="info">Você ainda não tem carteiras. Preencha os dados para cadastrar a principal.</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,417px)_minmax(0,417px)] lg:justify-between">
        <FormField id="w-name" label="Nome de exibição" required autoComplete="name" error={errors.name?.message} {...register('name')} />
        <FormField id="w-label" label="Apelido da carteira" required error={errors.label?.message} {...register('label')} />
        <SelectField id="w-network" label="Rede" required error={errors.network?.message} {...register('network')}>
          {networks.map((n) => (
            <option key={n} value={n}>
              {networkLabels[n as Network]}
            </option>
          ))}
        </SelectField>
        <FormField id="w-username" label="Nome do perfil" required autoComplete="username" error={errors.username?.message} {...register('username')} />
        <FormField
          id="w-address"
          label="Endereço da carteira"
          required
          spellCheck={false}
          placeholder="Endereço 0x da carteira"
          className="font-mono text-[13px]"
          error={errors.address?.message}
          {...register('address')}
        />
        <FormField
          id="w-ens"
          label="ENS ou carteira secundária (opcional)"
          hideLabel
          placeholder="ENS ou carteira secundária (opcional)"
          error={errors.ens?.message}
          {...register('ens')}
        />
        <SelectField id="w-provider" label="Tipo de carteira" required error={errors.provider?.message} {...register('provider')}>
          {walletProviders.map((p) => (
            <option key={p} value={p}>
              {walletProviderLabels[p]}
            </option>
          ))}
        </SelectField>
        <FormField id="w-referral" label="Código de indicação" error={errors.referralCode?.message} {...register('referralCode')} />
        <FormField id="w-email" label="E-mail" required type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <EnsField id="w-ensname" error={errors.ensName?.message} {...register('ensName')} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-10 w-[131px] rounded-[3px] bg-primary text-sm font-bold leading-4 text-primary-foreground hover:brightness-110 disabled:opacity-60"
      >
        {pending ? 'Salvando…' : 'Salvar carteira'}
      </button>
    </form>
  )
}

function SecondaryWallet({ wallet, onEdit }: { wallet: Wallet; onEdit: () => void }) {
  const update = useUpdateWallet()
  return (
    <li className="flex flex-col gap-3 rounded-[6px] border border-border bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="flex flex-wrap items-center gap-2 text-base font-bold leading-4 text-foreground">
          {wallet.label}
          <span className="text-xs font-normal text-subtle">
            {walletProviderLabels[wallet.provider]} · {networkLabels[wallet.network]}
            {wallet.connected ? ' · Conectada' : ''}
          </span>
        </p>
        <p className="font-mono text-sm text-muted-foreground" title={wallet.address}>
          {wallet.ens ?? shortAddress(wallet.address)}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={update.isPending}
          onClick={() =>
            update.mutate(
              { id: wallet.id, body: { isPrimary: true } },
              {
                onSuccess: () => toast({ title: 'Carteira principal atualizada', variant: 'success' }),
                onError: (e) => toast({ title: 'Não foi possível atualizar', description: toApiError(e).message, variant: 'destructive' }),
              },
            )
          }
        >
          Tornar principal
        </Button>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Editar
        </Button>
      </div>
    </li>
  )
}

function WalletForm({ wallet, onDone }: { wallet: Wallet | null; onDone: () => void }) {
  const create = useCreateWallet()
  const update = useUpdateWallet()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<WalletBody>({
    resolver: zodResolver(walletBodySchema),
    defaultValues: wallet
      ? { label: wallet.label, address: wallet.address, network: wallet.network, provider: wallet.provider, ens: wallet.ens ?? '', isPrimary: wallet.isPrimary }
      : { label: '', address: '', network: 'ethereum', provider: 'metamask', ens: '', isPrimary: false },
  })
  const pending = create.isPending || update.isPending

  async function onSubmit(values: WalletBody) {
    setFormError(null)
    try {
      const body = { ...values, ens: values.ens || null }
      if (wallet) await update.mutateAsync({ id: wallet.id, body })
      else await create.mutateAsync(body)
      toast({ title: wallet ? 'Carteira atualizada' : 'Carteira cadastrada', variant: 'success' })
      onDone()
    } catch (e) {
      if (!applyApiFieldErrors(e, setError, ['label', 'address', 'network', 'provider', 'ens'])) setFormError(toApiError(e).message)
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex flex-col gap-1 pr-8">
        <DialogTitle>{wallet ? 'Editar carteira' : 'Adicionar carteira'}</DialogTitle>
        <DialogDescription>Use um endereço fictício de demonstração (0x + 40 caracteres hexadecimais).</DialogDescription>
      </div>
      {formError ? <Alert variant="destructive">{formError}</Alert> : null}
      <FormField id="d-label" label="Apelido da carteira" required error={errors.label?.message} {...register('label')} />
      <FormField
        id="d-address"
        label="Endereço da carteira"
        required
        spellCheck={false}
        placeholder="0x…"
        className="font-mono text-[13px]"
        error={errors.address?.message}
        {...register('address')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField id="d-network" label="Rede" required error={errors.network?.message} {...register('network')}>
          {networks.map((n) => (
            <option key={n} value={n}>
              {networkLabels[n]}
            </option>
          ))}
        </SelectField>
        <SelectField id="d-provider" label="Tipo de carteira" required error={errors.provider?.message} {...register('provider')}>
          {walletProviders.map((p) => (
            <option key={p} value={p}>
              {walletProviderLabels[p]}
            </option>
          ))}
        </SelectField>
      </div>
      <FormField id="d-ens" label="ENS (opcional)" placeholder="nome.eth" error={errors.ens?.message} {...register('ens')} />
      {!wallet?.isPrimary ? (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" {...register('isPrimary')} />
          Definir como carteira principal
        </label>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
