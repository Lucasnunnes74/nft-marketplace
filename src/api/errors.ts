import axios, { type AxiosError } from 'axios'
import { type ApiErrorBody, apiErrorBodySchema, type ErrorCode } from './contracts'

export type ClientErrorCode = ErrorCode | 'NETWORK' | 'TIMEOUT' | 'ABORTED' | 'UNKNOWN'

/** Erro normalizado: a interface nunca precisa conhecer Axios nem o formato do transporte. */
export class ApiError extends Error {
  readonly status: number
  readonly code: ClientErrorCode
  readonly fields: Record<string, string>
  readonly details: unknown

  constructor(init: {
    message: string
    status: number
    code: ClientErrorCode
    fields?: Record<string, string>
    details?: unknown
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fields = init.fields ?? {}
    this.details = init.details
  }

  /** Falhas transitórias: seguras para repetir em leituras. */
  get isTransient() {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT' || this.status >= 500
  }

  get isAuth() {
    return this.code === 'UNAUTHENTICATED' || this.code === 'SESSION_EXPIRED'
  }
}

export function isAbortError(error: unknown) {
  return axios.isCancel(error) || (error instanceof DOMException && error.name === 'AbortError')
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isCancel(error)) {
    return new ApiError({ message: 'Requisição cancelada', status: 0, code: 'ABORTED' })
  }
  if (axios.isAxiosError(error)) {
    const err = error as AxiosError<unknown>
    if (err.response) {
      const parsed = apiErrorBodySchema.safeParse(err.response.data)
      if (parsed.success) return fromBody(err.response.status, parsed.data)
      // 404/405 sem corpo de erro da API: a chamada não chegou ao backend esperado (ex.: página sem o servidor simulado).
      const unreachable = err.response.status === 404 || err.response.status === 405
      return new ApiError({
        message: unreachable
          ? 'O servidor não respondeu a esta operação. Recarregue a página e tente de novo.'
          : 'Não foi possível concluir a operação.',
        status: err.response.status,
        code: err.response.status >= 500 ? 'SERVICE_UNAVAILABLE' : 'UNKNOWN',
      })
    }
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return new ApiError({ message: 'A requisição demorou demais para responder.', status: 0, code: 'TIMEOUT' })
    }
    return new ApiError({ message: 'Sem conexão com o servidor. Verifique sua rede.', status: 0, code: 'NETWORK' })
  }
  return new ApiError({
    message: error instanceof Error ? error.message : 'Erro inesperado.',
    status: 0,
    code: 'UNKNOWN',
  })
}

function fromBody(status: number, body: ApiErrorBody) {
  return new ApiError({
    message: body.error.message,
    status,
    code: body.error.code,
    fields: body.error.fields,
    details: body.error.details,
  })
}
