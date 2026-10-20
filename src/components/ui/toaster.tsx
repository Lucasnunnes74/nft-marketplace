import { X } from 'lucide-react'
import { dismissToast, toastStore } from '@/stores/toasts'
import { Alert } from './alert'

/** Região live: leitores de tela anunciam avisos sem roubar o foco. */
export function Toaster() {
  const toasts = toastStore.use()
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto relative shadow-lg">
          <Alert variant={t.variant} title={t.title} className="bg-card pr-9">
            {t.description}
          </Alert>
          <button
            type="button"
            aria-label="Dispensar aviso"
            className="absolute right-2 top-2 rounded p-1 opacity-70 hover:opacity-100"
            onClick={() => dismissToast(t.id)}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
