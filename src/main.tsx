import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

async function bootstrap() {
  // O código do App baixa em paralelo com o MSW. O socket.io-client fica fora dele (é carregado
  // sob demanda em `RealtimeBridge`): o engine.io-client captura `globalThis.WebSocket` ao ser
  // avaliado e, se isso acontecesse antes do MSW, guardaria o WebSocket nativo e a conexão não
  // seria interceptada.
  const app = import('./App')
  // Mocks (MSW) ficam ativos em dev e no build de demonstração; nada de mock em código de tela.
  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { startMocks, reloadIfWorkerIsBypassed } = await import('./mocks/browser')
    await startMocks()
    if (await reloadIfWorkerIsBypassed()) return
  }
  const { default: App } = await app
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
