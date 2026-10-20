import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useSessionState } from '@/auth/use-session'

/**
 * Mantém uma única conexão Socket.IO por sessão; encerra listeners ao trocar de sessão/desmontar.
 * O módulo do socket é carregado sob demanda: o engine.io-client captura `globalThis.WebSocket` ao ser
 * avaliado, então só pode rodar depois que o MSW iniciou (ver `main.tsx`), e isso também tira o
 * socket.io-client do carregamento inicial.
 */
export function RealtimeBridge() {
  const qc = useQueryClient()
  const { session } = useSessionState()
  const token = session?.token ?? null
  const userId = session?.userId ?? null

  useEffect(() => {
    let cancelled = false
    let dispose: (() => void) | undefined
    void import('@/realtime/socket').then(({ connectRealtime }) => {
      if (!cancelled) dispose = connectRealtime(qc, { token, userId })
    })
    return () => {
      cancelled = true
      dispose?.()
    }
  }, [qc, token, userId])

  return null
}
