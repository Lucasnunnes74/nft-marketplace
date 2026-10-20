import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/errors'

/**
 * Política de cache e retries (documentada em docs/ARCHITECTURE.md):
 *  - staleTime 30s: navegar entre telas não refaz requisições à toa;
 *  - gcTime 5min: dados inativos são descartados;
 *  - retries só para falhas transitórias (rede, timeout, 5xx), no máximo 2,
 *    com backoff exponencial; 4xx nunca é repetido;
 *  - mutations não repetem sozinhas (evita duplicar operações); a criação
 *    de pedido usa Idempotency-Key e repete de forma controlada.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => error instanceof ApiError && error.isTransient && failureCount < 2,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
    },
    mutations: { retry: false },
  },
})
