import * as React from 'react'
import { cn } from '@/lib/utils'
import { FigmaIcon } from './figma-icon'

type Common = {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  /** Rótulo só para leitores de tela (campos que no layout usam apenas placeholder). */
  hideLabel?: boolean
  className?: string
}

function Label({ id, label, required, hideLabel }: Pick<Common, 'id' | 'label' | 'required' | 'hideLabel'>) {
  return (
    <label htmlFor={id} className={cn('k-label min-h-[29px] gap-0.5', hideLabel && 'sr-only')}>
      {label}
      {required ? (
        <span className="k-required" aria-hidden>
          *
        </span>
      ) : null}
      {required ? <span className="sr-only"> (obrigatório)</span> : null}
    </label>
  )
}

function Message({ id, error, hint }: Pick<Common, 'id' | 'error' | 'hint'>) {
  if (error) {
    return (
      <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-coral">
        {error}
      </p>
    )
  }
  if (hint) {
    return (
      <p id={`${id}-hint`} className="mt-1 text-xs text-subtle">
        {hint}
      </p>
    )
  }
  return null
}

const describedBy = (id: string, error?: string, hint?: string) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined)

/** Campo de formulário do layout: rótulo 15px com asterisco coral, caixa 40px com borda #3F2319. */
export const FormField = React.forwardRef<HTMLInputElement, Common & React.InputHTMLAttributes<HTMLInputElement>>(
  ({ id, label, required, error, hint, hideLabel, className, ...input }, ref) => (
    <div className={cn('flex flex-col', hideLabel && 'justify-end')}>
      <Label id={id} label={label} required={required} hideLabel={hideLabel} />
      <input
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        aria-required={required || undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn('k-input', className)}
        {...input}
      />
      <Message id={id} error={error} hint={hint} />
    </div>
  ),
)
FormField.displayName = 'FormField'

export const SelectField = React.forwardRef<HTMLSelectElement, Common & React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ id, label, required, error, hint, hideLabel, className, children, ...select }, ref) => (
    <div className="flex flex-col">
      <Label id={id} label={label} required={required} hideLabel={hideLabel} />
      <div className="relative">
        <select
          ref={ref}
          id={id}
          aria-invalid={Boolean(error)}
          aria-required={required || undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn('k-input cursor-pointer appearance-none pr-9 [&>option]:bg-card', className)}
          {...select}
        >
          {children}
        </select>
        <FigmaIcon name="icon-select-arrow" width={18} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-subtle" />
      </div>
      <Message id={id} error={error} hint={hint} />
    </div>
  ),
)
SelectField.displayName = 'SelectField'

/** Senha com botão de mostrar/ocultar (ícone "Hide" do layout). */
export const PasswordField = React.forwardRef<
  HTMLInputElement,
  Common & React.InputHTMLAttributes<HTMLInputElement> & { inputClassName?: string }
>(({ id, label, required, error, hint, hideLabel, className, inputClassName, ...input }, ref) => {
  const [visible, setVisible] = React.useState(false)
  return (
    <div className={cn('flex flex-col', className)}>
      <Label id={id} label={label} required={required} hideLabel={hideLabel} />
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          aria-required={required || undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn('k-input pr-11', inputClassName)}
          {...input}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-controls={id}
          title={visible ? 'Ocultar caracteres' : 'Mostrar caracteres'}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center text-subtle hover:text-accent"
        >
          <span className="sr-only">{visible ? 'Ocultar caracteres' : 'Mostrar caracteres'}</span>
          {visible ? <EyeOpen /> : <FigmaIcon name="icon-hide-outline" width={17} height={14} />}
        </button>
      </div>
      <Message id={id} error={error} hint={hint} />
    </div>
  )
})
PasswordField.displayName = 'PasswordField'

function EyeOpen() {
  return (
    <svg aria-hidden width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M1 7s3-5.5 8-5.5S17 7 17 7s-3 5.5-8 5.5S1 7 1 7Z" />
      <circle cx="9" cy="7" r="2.4" />
    </svg>
  )
}

/** "Nome ENS": domínio .eth (78px) + nome. */
export const EnsField = React.forwardRef<HTMLInputElement, { id: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>>(
  ({ id, error, ...input }, ref) => (
    <div className="flex flex-col">
      <label htmlFor={id} className="k-label min-h-[29px]">
        Nome ENS
      </label>
      <div className="flex gap-2.5">
        <span aria-hidden className="flex h-10 w-[78px] shrink-0 items-center gap-1.5 rounded-[3px] border border-border pl-2.5 text-[15px] text-foreground">
          .eth
          <FigmaIcon name="icon-arrow-down" width={20} />
        </span>
        <input
          ref={ref}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : `${id}-suffix`}
          className="k-input"
          placeholder="seu-nome"
          {...input}
        />
        <span id={`${id}-suffix`} className="sr-only">
          Domínio .eth
        </span>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-coral">
          {error}
        </p>
      ) : null}
    </div>
  ),
)
EnsField.displayName = 'EnsField'
