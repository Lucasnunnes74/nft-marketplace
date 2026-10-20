import { ChevronDown } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

/** Select nativo estilizado: acessível por padrão, teclado e leitores de tela sem custo extra. */
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'h-10 w-full appearance-none rounded-md border border-input bg-card pl-3 pr-9 text-sm disabled:opacity-50 aria-[invalid=true]:border-destructive',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground" />
    </div>
  ),
)
Select.displayName = 'Select'
export { Select }
