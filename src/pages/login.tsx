import { zodResolver } from '@hookform/resolvers/zod'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { type LoginBody, loginBodySchema } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { AuthShell, useAuthFieldClass } from '@/components/auth/auth-shell'
import { Alert } from '@/components/ui/alert'
import { FormField, PasswordField } from '@/components/ui/form-field'
import { useLogin } from '@/hooks/use-api'
import { useIsDesktop } from '@/hooks/use-media'
import { usePageTitle } from '@/hooks/use-page'
import { applyApiFieldErrors } from '@/lib/form'
import { safeRedirect } from '@/lib/format'
import { cn } from '@/lib/utils'

const route = getRouteApi('/login')

const reasons = {
  expired: 'Sua sessão expirou. Entre novamente para continuar de onde parou.',
  favorite: 'Entre para salvar favoritos.',
  checkout: 'Entre para finalizar sua compra. Seu carrinho será mantido.',
} as const

export function LoginPage() {
  usePageTitle('Entrar')
  const { redirect, reason } = route.useSearch()
  const navigate = useNavigate()
  const login = useLogin()
  const isDesktop = useIsDesktop()
  const field = useAuthFieldClass()
  const [formError, setFormError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginBody>({ resolver: zodResolver(loginBodySchema), defaultValues: { email: '', password: '' } })

  async function onSubmit(values: LoginBody) {
    setFormError(null)
    try {
      await login.mutateAsync(values)
      // Volta exatamente ao ponto de origem (caminho + busca).
      void navigate({ to: safeRedirect(redirect), replace: true })
    } catch (e) {
      if (!applyApiFieldErrors(e, setError, ['email', 'password'])) setFormError(toApiError(e).message)
    }
  }

  return (
    <AuthShell
      mode="login"
      redirect={redirect}
      title="Entrar"
      mobileTitle="Entrar"
      description="Entre para gerenciar sua carteira, coleção e perfil de criador."
      footer={
        <p className="flex flex-col items-center gap-1 text-center">
          <span>
            Novo na Kurio?{' '}
            <Link to="/signup" search={{ redirect }} className="text-accent hover:underline">
              Crie uma conta
            </Link>
          </span>
          <span className="text-xs text-subtle">
            Demonstração: <code>demo@nft.test</code> / <code>Demo@1234</code>
          </span>
        </p>
      }
    >
      <form className={cn('flex flex-col', isDesktop ? 'gap-6 px-20 pt-6' : 'gap-10')} onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-3">
          {reason ? <Alert variant={reason === 'expired' ? 'warning' : 'info'}>{reasons[reason]}</Alert> : null}
          {formError ? (
            <Alert variant="destructive" title="Não foi possível entrar">
              {formError}
            </Alert>
          ) : null}
          <FormField
            id="email"
            label="E-mail"
            hideLabel
            type="email"
            autoComplete="email"
            placeholder="contato@email.com"
            error={errors.email?.message}
            className={field}
            {...register('email')}
          />
          <PasswordField
            id="password"
            label="Senha"
            hideLabel
            autoComplete="current-password"
            placeholder="Senha"
            error={errors.password?.message}
            inputClassName={cn(field, 'text-base')}
            {...register('password')}
          />
          <div className="flex flex-col items-end gap-2">
            <button type="button" aria-expanded={showHelp} onClick={() => setShowHelp((v) => !v)} className="text-sm leading-4 text-accent hover:underline">
              Esqueceu a senha?
            </button>
            {showHelp ? (
              <p role="status" className="text-right text-xs text-muted-foreground">
                A recuperação de senha é simulada. Use a conta de demonstração: demo@nft.test / Demo@1234.
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="submit"
          disabled={login.isPending}
          className={cn(
            'flex w-full items-center justify-center bg-primary text-base font-bold leading-4 text-primary-foreground hover:brightness-110 disabled:opacity-60',
            isDesktop ? 'h-[45px] rounded-[5px]' : 'h-[60px] rounded-[10px]',
          )}
        >
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </AuthShell>
  )
}
