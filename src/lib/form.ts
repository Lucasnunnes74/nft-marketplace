import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '@/api/errors'

/** Aplica erros de campo devolvidos pela API (422/409) ao formulário; devolve true se tratou algum. */
export function applyApiFieldErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, known: string[]) {
  if (!(error instanceof ApiError)) return false
  let applied = false
  for (const [field, message] of Object.entries(error.fields)) {
    if (known.includes(field)) {
      setError(field as Path<T>, { type: 'server', message })
      applied = true
    }
  }
  return applied
}
