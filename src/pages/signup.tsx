import { zodResolver } from '@hookform/resolvers/zod'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { signupBodySchema } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { AuthShell, useAuthFieldClass } from '@/components/auth/auth-shell'
import { Alert } from '@/components/ui/alert'
import { FormField, PasswordField } from '@/components/ui/form-field'
import { useSignup } from '@/hooks/use-api'
import { useIsDesktop } from '@/hooks/use-media'
import { usePageTitle } from '@/hooks/use-page'
import { applyApiFieldErrors } from '@/lib/form'
import { safeRedirect } from '@/lib/format'
import { cn } from '@/lib/utils'

const route = getRouteApi('/signup')

const signupFormSchema = signupBodySchema
  .extend({ confirm: z.string().min(1, 'Confirme a senha') })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'As senhas não coincidem' })
type SignupForm = z.infer<typeof signupFormSchema>

export function SignupPage() {
  usePageTitle('Criar conta')
  const { redirect } = route.useSearch()
  const navigate = useNavigate()
  const signup = useSignup()
  const isDesktop = useIsDesktop()
  const field = useAuthFieldClass()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: { name: '', email: '', password: '', confirm: '' },
  })

  async function onSubmit({ confirm: _confirm, ...values }: SignupForm) {
    setFormError(null)
    try {
      await signup.mutateAsync(values)
      void navigate({ to: safeRedirect(redirect), replace: true })
    } catch (e) {
      // Conflito (e-mail já cadastrado) e validação do servidor aparecem junto ao campo.
      if (!applyApiFieldErrors(e, setError, ['name', 'email', 'password'])) setFormError(toApiError(e).message)
    }
  }

  return (
    <AuthShell
      mode="signup"
      redirect={redirect}
      title="Criar conta"
      mobileTitle="Criar perfil de colecionador"
      description="Crie seu perfil de colecionador e conecte uma carteira quando quiser."
      footer={
        <p>
          Já tem uma conta?{' '}
          <Link to="/login" search={{ redirect }} className="text-accent hover:underline">
            Entre
          </Link>
        </p>
      }
    >
      <form className={cn('flex flex-col', isDesktop ? 'gap-6 px-20 pt-6' : 'gap-10')} onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-3">
          {formError ? (
            <Alert variant="destructive" title="Não foi possível criar a conta">
              {formError}
            </Alert>
          ) : null}
          <FormField
            id="name"
            label="Nome de usuário"
            hideLabel
            autoComplete="nickname"
            placeholder="Nome de usuário"
            error={errors.name?.message}
            className={field}
            {...register('name')}
          />
          <FormField
            id="email"
            label="E-mail"
            hideLabel
            type="email"
            autoComplete="email"
            placeholder="Digite seu e-mail"
            error={errors.email?.message}
            className={field}
            {...register('email')}
          />
          <PasswordField
            id="password"
            label="Senha"
            hideLabel
            autoComplete="new-password"
            placeholder="Senha"
            hint="Mínimo de 8 caracteres, com letra e número."
            error={errors.password?.message}
            inputClassName={field}
            {...register('password')}
          />
          <PasswordField
            id="confirm"
            label="Confirmar senha"
            hideLabel
            autoComplete="new-password"
            placeholder="Confirmar senha"
            error={errors.confirm?.message}
            inputClassName={field}
            {...register('confirm')}
          />
        </div>
        <button
          type="submit"
          disabled={signup.isPending}
          className={cn(
            'flex w-full items-center justify-center bg-primary text-base font-bold leading-4 text-primary-foreground hover:brightness-110 disabled:opacity-60',
            isDesktop ? 'h-[45px] rounded-[5px]' : 'h-[60px] rounded-[10px]',
          )}
        >
          {signup.isPending ? 'Criando conta…' : isDesktop ? 'Criar conta' : 'Criar perfil'}
        </button>
      </form>
    </AuthShell>
  )
}
