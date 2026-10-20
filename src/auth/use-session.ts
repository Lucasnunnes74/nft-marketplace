import { useSyncExternalStore } from 'react'
import { sessionStore } from './session-store'

export function useSessionState() {
  const state = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot, sessionStore.getSnapshot)
  return { session: state, isAuthenticated: Boolean(state), userId: state?.userId ?? null }
}
