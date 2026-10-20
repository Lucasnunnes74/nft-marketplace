import type { Network } from '@/api/contracts'
import { db, liveNft, patchNft } from './db'
import { connectionCount, dropConnections, emitNftUpdated } from './realtime'
import { type Scenario, scenarioStore } from './scenario'
import { seedNfts } from './seed'

/**
 * Controle programático dos mocks, exposto em `window.__mock`.
 * Usado pelo painel de simulação e pelos testes E2E para montar cenários
 * determinísticos sem depender de tempo ou aleatoriedade.
 */
export type MockControl = {
  scenario: () => Scenario
  setScenario: (patch: Partial<Scenario>) => void
  reset: () => void
  /** Atualiza preço/estoque de um NFT e emite `nft.updated`. */
  updateNft: (id: string, patch: { price?: string; available?: number }) => unknown
  /** Invalida a sessão no servidor: a próxima chamada autenticada recebe 401. */
  expireSessions: () => void
  /** Derruba o WebSocket para testar reconexão e reconciliação. */
  dropSocket: () => void
  socketConnections: () => number
  networks: Network[]
}

declare global {
  interface Window {
    __mock?: MockControl
  }
}

let tickerId: ReturnType<typeof setInterval> | null = null

function syncTicker() {
  const on = scenarioStore.get().ticker
  if (on && !tickerId) {
    tickerId = setInterval(() => {
      const base = seedNfts[Math.floor(Math.random() * seedNfts.length)]
      const n = liveNft(base.id)
      if (!n) return
      const bump = Math.random() > 0.5
      const patch = bump
        ? { price: addPercent(n.price, Math.random() > 0.5 ? 300 : -300) }
        : { available: Math.max(0, n.available - 1) }
      const evt = patchNft(n.id, patch)
      if (evt) emitNftUpdated(evt)
    }, 12_000)
  } else if (!on && tickerId) {
    clearInterval(tickerId)
    tickerId = null
  }
}

function addPercent(price: string, bps: number) {
  const next = (Number(price) * (10_000 + bps)) / 10_000
  return Math.max(0.0001, next).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

export function installMockControl() {
  scenarioStoreSubscribeOnce()
  syncTicker()
  window.__mock = {
    scenario: () => scenarioStore.get(),
    setScenario: (patch) => scenarioStore.set(patch),
    reset: () => {
      db.reset()
      scenarioStore.reset()
      try {
        localStorage.removeItem('nft.session')
        localStorage.removeItem('nft.guest')
      } catch {
        /* noop */
      }
    },
    updateNft: (id, patch) => {
      const evt = patchNft(id, patch)
      if (evt) emitNftUpdated(evt)
      return evt
    },
    expireSessions: () => {
      db.state.sessions = {}
      db.save()
    },
    dropSocket: dropConnections,
    socketConnections: connectionCount,
    networks: ['ethereum', 'polygon', 'arbitrum', 'base'],
  }
}

let subscribed = false
function scenarioStoreSubscribeOnce() {
  if (subscribed) return
  subscribed = true
  scenarioStore.subscribe(syncTicker)
}
