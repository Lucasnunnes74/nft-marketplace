import axios from 'axios'
import { getGuestId, sessionStore } from '@/auth/session-store'
import { toApiError } from './errors'

/** Todas as chamadas REST passam por este cliente Axios. */
export const http = axios.create({
  baseURL: '/api',
  timeout: 8000,
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use((config) => {
  const session = sessionStore.getSnapshot()
  if (session) config.headers.set('Authorization', `Bearer ${session.token}`)
  // Visitante: o carrinho é associado a um id local, mesclado ao autenticar.
  config.headers.set('X-Guest-Id', getGuestId())
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error)
    if (apiError.isAuth && sessionStore.getSnapshot()) {
      sessionStore.end(apiError.code === 'SESSION_EXPIRED' ? 'expired' : 'unauthorized')
    }
    return Promise.reject(apiError)
  },
)
