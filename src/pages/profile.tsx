import { zodResolver } from '@hookform/resolvers/zod'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ensLabelRule, passwordRule, type User, usernameRule, type Wallet } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { AccountLayout } from '@/components/account/account-layout'
import { EmptyState, ErrorState } from '@/components/common/states'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FigmaIcon } from '@/components/ui/figma-icon'
import { EnsField, FormField, PasswordField } from '@/components/ui/form-field'
import { Skeleton } from '@/components/ui/skeleton'
import { useChangePassword, useCurrentUser, useFavorites, useUpdateProfile, useUpdateWallet, useWallets } from '@/hooks/use-api'
import { usePageTitle } from '@/hooks/use-page'
import { applyApiFieldErrors } from '@/lib/form'
import { toast } from '@/stores/toasts'

const route = getRouteApi('/profile')
const MAX_AVATAR_BYTES = 150 * 1024

const profileFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Informe seu nome de exibição'),
    username: usernameRule,
    email: z.string().min(1, 'Informe o e-mail').pipe(z.email('E-mail inválido')),
    ensName: ensLabelRule,
    walletLabel: z.string().trim(),
    hasWallet: z.boolean(),
    currentPassword: z.string(),
    newPassword: z.string(),
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.hasWallet && v.walletLabel.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['walletLabel'], message: 'Dê um apelido à carteira' })
    }
    // Troca de senha é opcional: só valida se algum dos três campos foi preenchido.
    if (v.currentPassword || v.newPassword || v.confirm) {
      if (!v.currentPassword) ctx.addIssue({ code: 'custom', path: ['currentPassword'], message: 'Informe a senha atual' })
      const rule = passwordRule.safeParse(v.newPassword)
      if (!rule.success) ctx.addIssue({ code: 'custom', path: ['newPassword'], message: rule.error.issues[0]?.message ?? 'Senha inválida' })
      if (v.newPassword !== v.confirm) ctx.addIssue({ code: 'custom', path: ['confirm'], message: 'As senhas não coincidem' })
    }
  })
type ProfileForm = z.infer<typeof profileFormSchema>

export function ProfilePage() {
  const { section } = route.useSearch()
  const favoritesView = section === 'interesse'
  usePageTitle(favoritesView ? 'Lista de interesse' : 'Meu perfil')
  const user = useCurrentUser()
  const wallets = useWallets()

  return (
    <AccountLayout active={favoritesView ? 'interesse' : 'dados'}>
      {favoritesView ? (
        <Favorites />
      ) : user.isPending || wallets.isPending ? (
        <div className="flex flex-col gap-6" aria-busy aria-label="Carregando perfil">
          <Skeleton className="h-4 w-48 bg-card" />
          <Skeleton className="h-64 w-full bg-card" />
        </div>
      ) : user.isError ? (
        <ErrorState error={user.error} onRetry={() => void user.refetch()} retrying={user.isFetching} />
      ) : (
        <ProfileFormView
          key={`${user.data.user.name}|${user.data.user.email}|${user.data.user.avatar ?? ''}`}
          user={user.data.user}
          wallet={wallets.data?.find((w) => w.isPrimary) ?? wallets.data?.[0]}
        />
      )}
    </AccountLayout>
  )
}

function ProfileFormView({ user, wallet }: { user: User; wallet: Wallet | undefined }) {
  const update = useUpdateProfile()
  const updateWallet = useUpdateWallet()
  const change = useChangePassword()
  const [avatar, setAvatar] = useState<string | null>(user.avatar)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const {
    register,
    handleSubmit,
    setError,
    resetField,
    formState: { errors, dirtyFields },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user.name,
      username: user.username,
      email: user.email,
      ensName: user.ensName ?? '',
      walletLabel: wallet?.label ?? '',
      hasWallet: Boolean(wallet),
      currentPassword: '',
      newPassword: '',
      confirm: '',
    },
  })
  const pending = update.isPending || updateWallet.isPending || change.isPending

  function onFile(file: File | undefined) {
    setAvatarError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) return setAvatarError('Envie um arquivo de imagem.')
    if (file.size > MAX_AVATAR_BYTES) return setAvatarError('A imagem deve ter até 150 KB.')
    const reader = new FileReader()
    reader.onload = () => setAvatar(String(reader.result))
    reader.readAsDataURL(file)
  }

  async function onSubmit(values: ProfileForm) {
    setFormError(null)
    const profileChanged = Boolean(dirtyFields.name || dirtyFields.username || dirtyFields.email || dirtyFields.ensName) || avatar !== user.avatar
    const walletChanged = Boolean(wallet && dirtyFields.walletLabel)
    const passwordChanged = Boolean(values.currentPassword)
    if (!profileChanged && !walletChanged && !passwordChanged) {
      toast({ title: 'Nada para salvar', description: 'Nenhum dado foi alterado.' })
      return
    }
    const saved: string[] = []
    try {
      if (profileChanged) {
        await update.mutateAsync({
          name: values.name,
          username: values.username,
          email: values.email,
          ensName: values.ensName || null,
          avatar,
        })
        saved.push('perfil')
      }
      if (walletChanged && wallet) {
        await updateWallet.mutateAsync({ id: wallet.id, body: { label: values.walletLabel } })
        saved.push('carteira')
      }
      if (passwordChanged) {
        await change.mutateAsync({ currentPassword: values.currentPassword, newPassword: values.newPassword })
        resetField('currentPassword')
        resetField('newPassword')
        resetField('confirm')
        saved.push('senha')
      }
      toast({ title: 'Alterações salvas', description: `Atualizado: ${saved.join(', ')}.`, variant: 'success' })
    } catch (e) {
      const known = ['name', 'username', 'email', 'ensName', 'currentPassword', 'newPassword']
      if (!applyApiFieldErrors(e, setError, known)) setFormError(toApiError(e).message)
    }
  }

  return (
    <form className="flex flex-col gap-8" onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className="text-base font-bold leading-4 text-foreground">Perfil do colecionador</h2>
      {formError ? <Alert variant="destructive">{formError}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,417px)_minmax(0,417px)] lg:justify-between">
        <FormField id="p-name" label="Nome de exibição" required autoComplete="name" error={errors.name?.message} {...register('name')} />
        <FormField id="p-username" label="Nome de usuário" required autoComplete="username" error={errors.username?.message} {...register('username')} />
        <FormField id="p-email" label="E-mail" required type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <EnsField id="p-ens" error={errors.ensName?.message} {...register('ensName')} />
        {wallet ? (
          <FormField id="p-wallet" label="Apelido da carteira" required error={errors.walletLabel?.message} {...register('walletLabel')} />
        ) : (
          <div className="flex flex-col justify-end text-sm text-muted-foreground">
            <Link to="/wallets" className="text-accent hover:underline">
              Cadastre uma carteira
            </Link>{' '}
            para definir o apelido.
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          <span className="text-[15px] leading-[15px] text-foreground" id="avatar-label">
            Avatar
          </span>
          <div className="flex items-center gap-6" role="group" aria-labelledby="avatar-label">
            <span className="grid size-[50px] shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-raised text-accent">
              {avatar ? (
                <img src={avatar} alt="Foto de perfil" className="size-full object-cover" />
              ) : (
                <FigmaIcon name="icon-image" width={20} />
              )}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Enviar foto de perfil"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-10 w-[98px] rounded-[3px] bg-primary text-sm font-bold leading-4 text-primary-foreground hover:brightness-110"
              >
                Alterar
              </button>
              <button
                type="button"
                disabled={!avatar}
                onClick={() => setAvatar(null)}
                className="text-sm leading-4 text-foreground hover:text-accent disabled:opacity-50"
              >
                Remover
              </button>
            </div>
          </div>
          {avatarError ? (
            <p role="alert" className="text-xs text-coral">
              {avatarError}
            </p>
          ) : (
            <p className="text-xs text-subtle">PNG ou JPG, até 150 KB.</p>
          )}
        </div>
      </div>

      <fieldset className="flex flex-col gap-6">
        <legend className="mb-6 text-base font-medium leading-4 text-foreground">Alterar senha</legend>
        <PasswordField
          id="pw-current"
          label="Senha atual"
          autoComplete="current-password"
          className="max-w-[417px] gap-1.5"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <PasswordField
          id="pw-new"
          label="Nova senha"
          autoComplete="new-password"
          className="max-w-[417px] gap-1.5"
          hint="Mínimo de 8 caracteres, com letra e número."
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <PasswordField
          id="pw-confirm"
          label="Confirmar nova senha"
          autoComplete="new-password"
          className="max-w-[417px] gap-1.5"
          error={errors.confirm?.message}
          {...register('confirm')}
        />
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="h-10 w-[131px] rounded-[3px] bg-primary text-sm font-bold leading-4 text-primary-foreground hover:brightness-110 disabled:opacity-60"
      >
        {pending ? 'Salvando…' : 'Salvar'}
      </button>
    </form>
  )
}

function Favorites() {
  const favorites = useFavorites()
  return (
    <section aria-labelledby="fav-title" className="flex flex-col gap-8">
      <h2 id="fav-title" className="text-base font-bold leading-4 text-foreground">
        Lista de interesse
      </h2>
      {favorites.isError ? (
        <ErrorState error={favorites.error} onRetry={() => void favorites.refetch()} retrying={favorites.isFetching} />
      ) : favorites.isPending ? (
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
          <NftCardSkeleton />
          <NftCardSkeleton />
          <NftCardSkeleton />
        </div>
      ) : favorites.data.length === 0 ? (
        <EmptyState
          title="Nenhum favorito ainda"
          description="Use “Favoritar” na página de um NFT para guardá-lo aqui."
          action={
            <Button asChild variant="outline">
              <Link to="/" search={{}} hash="catalogo">
                Explorar NFTs
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-[34px]" data-testid="favorites-grid">
          {favorites.data.map((n) => (
            <li key={n.id}>
              <NftCard nft={n} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
