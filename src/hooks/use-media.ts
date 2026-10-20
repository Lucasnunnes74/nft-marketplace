import { useSyncExternalStore } from 'react'

const DESKTOP = '(min-width: 768px)'

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {}
  const mql = window.matchMedia(DESKTOP)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

/**
 * Layout desktop (≥ 768px). Header/rodapé desktop e a tab bar mobile são exclusivos:
 * renderizar só um evita controles duplicados (mesmo rótulo/test id) na árvore.
 * Sem matchMedia (jsdom), assume desktop.
 */
export function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(DESKTOP).matches : true),
    () => true,
  )
}
