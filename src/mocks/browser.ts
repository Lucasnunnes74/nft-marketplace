import { setupWorker } from 'msw/browser'
import { handlers, resumePendingOrders } from './handlers'
import { installMockControl } from './control'

export const worker = setupWorker(...handlers)

const RELOAD_FLAG = 'nft.sw-reloaded'

/**
 * Recarregamento forçado (Ctrl+F5) ou "Bypass for network" nas DevTools carregam a página sem passar
 * pelo service worker: as chamadas à API iriam ao servidor real (HTTP 404/405) e o app pareceria quebrado.
 * Uma recarga normal reativa o worker, então tentamos uma vez. Devolve true se iniciou a recarga.
 */
export async function reloadIfWorkerIsBypassed(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  if (!navigator.serviceWorker.controller) {
    // Na primeira visita o worker assume a página logo depois de ativar: espera um pouco antes de decidir.
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
      setTimeout(resolve, 600)
    })
  }
  try {
    if (navigator.serviceWorker.controller) {
      sessionStorage.removeItem(RELOAD_FLAG)
      return false
    }
    if (sessionStorage.getItem(RELOAD_FLAG)) return false // já tentou: evita laço de recargas
    sessionStorage.setItem(RELOAD_FLAG, '1')
  } catch {
    return false
  }
  location.reload()
  return true
}

export async function startMocks() {
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
  resumePendingOrders()
  installMockControl()
}
