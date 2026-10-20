import { setupWorker } from 'msw/browser'
import { handlers, resumePendingOrders } from './handlers'
import { installMockControl } from './control'

export const worker = setupWorker(...handlers)

export async function startMocks() {
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
  resumePendingOrders()
  installMockControl()
}
