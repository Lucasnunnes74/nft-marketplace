import { cva, type VariantProps } from 'class-variance-authority'
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const alertVariants = cva('flex gap-3 rounded-lg border p-4 text-sm', {
  variants: {
    variant: {
      info: 'border-accent/40 bg-accent/10',
      success: 'border-success/40 bg-success/10',
      warning: 'border-warning/40 bg-warning/10',
      destructive: 'border-destructive/40 bg-destructive/10',
    },
  },
  defaultVariants: { variant: 'info' },
})

const icons = { info: Info, success: CheckCircle2, warning: TriangleAlert, destructive: AlertCircle }

export function Alert({
  className,
  variant = 'info',
  title,
  children,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> &
  VariantProps<typeof alertVariants> & { title?: React.ReactNode }) {
  const Icon = icons[variant ?? 'info']
  return (
    <div
      role={variant === 'destructive' || variant === 'warning' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-muted-foreground [&_a]:text-foreground">{children}</div> : null}
      </div>
    </div>
  )
}
