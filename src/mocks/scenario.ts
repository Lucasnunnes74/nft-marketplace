/**
 * Cenários reproduzíveis da camada simulada.
 *
 * O estado fica em localStorage (sobrevive a refresh) e pode ser alterado pelo
 * painel de simulação, por `window.__mock` (usado nos testes E2E) ou
 * por fixtures. Flags "one-shot" são consumidas após uma única ocorrência.
 */
export type Latency = 'fast' | 'slow' | 'variable'
export type Failure = 'none' | 'network' | '500' | '503'
export type PaymentOutcome = 'confirmed' | 'refused'
export type WalletOutcome = 'ok' | 'refused' | 'disconnected'

export type Scenario = {
  latency: Latency
  failure: Failure
  payment: PaymentOutcome
  wallet: WalletOutcome
  /** Muda o preço de um item do carrinho no momento da compra (uma vez). */
  priceChangeOnCheckout: boolean
  /** Esgota um item do carrinho no momento da compra (uma vez). */
  soldOutOnCheckout: boolean
  /** O servidor processa o pedido mas responde após o timeout do cliente (uma vez). */
  orderTimeout: boolean
  /** Emite nft.updated periodicamente, simulando mercado ativo. */
  ticker: boolean
}

export const defaultScenario: Scenario = {
  latency: 'fast',
  failure: 'none',
  payment: 'confirmed',
  wallet: 'ok',
  priceChangeOnCheckout: false,
  soldOutOnCheckout: false,
  orderTimeout: false,
  ticker: false,
}

const KEY = 'nft.mock.scenario'
const listeners = new Set<() => void>()

function load(): Scenario {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...defaultScenario, ...(JSON.parse(raw) as Partial<Scenario>) } : { ...defaultScenario }
  } catch {
    return { ...defaultScenario }
  }
}

let current = load()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* noop */
  }
  for (const l of listeners) l()
}

export const scenarioStore = {
  get: () => current,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  set(patch: Partial<Scenario>) {
    current = { ...current, ...patch }
    persist()
  },
  reset() {
    current = { ...defaultScenario }
    persist()
  },
  /** Lê e zera uma flag one-shot. */
  consume(flag: 'priceChangeOnCheckout' | 'soldOutOnCheckout' | 'orderTimeout') {
    if (!current[flag]) return false
    current = { ...current, [flag]: false }
    persist()
    return true
  },
}

export function latencyMs(kind: Latency = current.latency) {
  if (kind === 'fast') return 40 + Math.floor(Math.random() * 90)
  if (kind === 'slow') return 1500 + Math.floor(Math.random() * 1500)
  // "variable": grande dispersão para provocar respostas fora de ordem.
  return 80 + Math.floor(Math.random() * 2400)
}
