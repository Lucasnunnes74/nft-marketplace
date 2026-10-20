import { useEffect } from 'react'

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Kurio` : 'Kurio — Marketplace de NFTs'
  }, [title])
}

export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Object.assign(
    (...args: A) => {
      clearTimeout(timer)
      timer = setTimeout(() => fn(...args), delay)
    },
    { cancel: () => clearTimeout(timer) },
  )
}
