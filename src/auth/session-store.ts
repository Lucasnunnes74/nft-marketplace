/**
 * Sessão no cliente: token, expiração e id do usuário.
 *
 * Persistida em localStorage para sobreviver a refresh. É uma store externa
 * mínima (useSyncExternalStore) — o estado do servidor continua no TanStack Query.
 */
const KEY = 'nft.session'
const GUEST_KEY = 'nft.guest'

export type StoredSession = { token: string; expiresAt: string; userId: string }
export type SessionEndReason = 'logout' | 'expired' | 'unauthorized'

const listeners = new Set<() => void>()
let endReason: SessionEndReason | null = null

function read(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    if (!parsed.token || !parsed.expiresAt) return null
    return parsed
  } catch {
    return null
  }
}

let state: StoredSession | null = read()

function emit() {
  for (const l of listeners) l()
}

export const sessionStore = {
  getSnapshot: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  start(session: StoredSession) {
    state = session
    endReason = null
    try {
      localStorage.setItem(KEY, JSON.stringify(session))
    } catch {
      /* armazenamento indisponível: a sessão vale só para esta aba */
    }
    emit()
  },
  end(reason: SessionEndReason) {
    if (!state) return
    state = null
    endReason = reason
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* noop */
    }
    emit()
  },
  /** Motivo do último encerramento (para mensagens como "sua sessão expirou"). */
  consumeEndReason() {
    const r = endReason
    endReason = null
    return r
  },
  isExpired(now = Date.now()) {
    return state ? new Date(state.expiresAt).getTime() <= now : false
  },
}

if (typeof window !== 'undefined') {
  // Sincroniza logout/login entre abas.
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    state = read()
    emit()
  })
}

export function getGuestId() {
  try {
    let id = localStorage.getItem(GUEST_KEY)
    if (!id) {
      id = `guest_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
      localStorage.setItem(GUEST_KEY, id)
    }
    return id
  } catch {
    return 'guest_volatile'
  }
}

export function clearGuestId() {
  try {
    localStorage.removeItem(GUEST_KEY)
  } catch {
    /* noop */
  }
}
