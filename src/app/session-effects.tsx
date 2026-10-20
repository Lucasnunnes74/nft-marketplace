import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { sessionStore } from '@/auth/session-store'
import { useSessionState } from '@/auth/use-session'
import { resetNftVersions } from '@/realtime/nft-versions'
import { clearNotices } from '@/stores/market-notices'
import { toast } from '@/stores/toasts'

/**
 * Reage a mudanças de sessão (login, logout, expiração):
 *  - limpa o cache do usuário anterior (nada privado vaza entre sessões);
 *  - reavalia os guardas de rota (rotas privadas redirecionam ao login,
 *    preservando o caminho de volta);
 *  - agenda a expiração local do token.
 */
export function SessionEffects() {
  const qc = useQueryClient()
  const router = useRouter()
  const { session, userId } = useSessionState()
  const previous = useRef<string | null>(userId)

  useEffect(() => {
    if (previous.current === userId) return
    previous.current = userId
    void qc.cancelQueries()
    qc.removeQueries()
    resetNftVersions()
    clearNotices()
    const reason = sessionStore.consumeEndReason()
    if (reason === 'expired' || reason === 'unauthorized') {
      toast({
        title: 'Sua sessão expirou',
        description: 'Entre novamente para continuar. Seu carrinho foi mantido.',
        variant: 'warning',
      })
    }
    void router.invalidate()
  }, [userId, qc, router])

  useEffect(() => {
    if (!session) return
    const ms = new Date(session.expiresAt).getTime() - Date.now()
    const id = setTimeout(() => sessionStore.end('expired'), Math.max(ms, 0))
    return () => clearTimeout(id)
  }, [session])

  return null
}
