import { useSyncExternalStore } from 'react'

/** Store externa mínima (sem dependências) para estado de UI que não vem do servidor. */
export function createStore<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(next: T | ((prev: T) => T)) {
      state = typeof next === 'function' ? (next as (p: T) => T)(state) : next
      for (const l of listeners) l()
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    use: () => useSyncExternalStore(
      (l) => {
        listeners.add(l)
        return () => listeners.delete(l)
      },
      () => state,
      () => state,
    ),
  }
}
