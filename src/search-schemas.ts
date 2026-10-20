import { defaultParseSearch, defaultStringifySearch } from '@tanstack/react-router'
import { z } from 'zod'
import { categorySchema, chainSchema, money, sortSchema } from '@/api/contracts'

export const catalogTabs = ['all', 'new', 'trending'] as const
export type CatalogTab = (typeof catalogTabs)[number]

const PRICE_KEYS = ['minPrice', 'maxPrice'] as const

/**
 * O parser padrão do roteador converte "0.10" em number (0.1) e perde casas decimais;
 * preços em ETH precisam continuar strings decimais, então são lidos e escritos crus.
 */
export function parseSearch(searchStr: string) {
  const parsed: Record<string, unknown> = defaultParseSearch(searchStr)
  const raw = new URLSearchParams(searchStr)
  for (const key of PRICE_KEYS) {
    const value = raw.get(key)
    if (value !== null) parsed[key] = value
  }
  return parsed
}

export function stringifySearch(search: Record<string, unknown>) {
  const { minPrice, maxPrice, ...rest } = search
  const base = defaultStringifySearch(rest)
  const prices = new URLSearchParams()
  if (typeof minPrice === 'string') prices.set('minPrice', minPrice)
  if (typeof maxPrice === 'string') prices.set('maxPrice', maxPrice)
  const tail = prices.toString()
  if (!tail) return base
  return base ? `${base}&${tail}` : `?${tail}`
}

/**
 * Estado do catálogo na URL. `.catch(undefined)` torna a URL tolerante:
 * parâmetros inválidos são ignorados em vez de quebrar a tela.
 */
export const homeSearchSchema = z.object({
  q: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .optional()
    .catch(undefined),
  category: categorySchema.optional().catch(undefined),
  chain: chainSchema.optional().catch(undefined),
  tab: z.enum(catalogTabs).optional().catch(undefined),
  minPrice: money.optional().catch(undefined),
  maxPrice: money.optional().catch(undefined),
  available: z.boolean().optional().catch(undefined),
  sort: sortSchema.optional().catch(undefined),
  page: z.number().int().positive().optional().catch(undefined),
})
export type HomeSearch = z.infer<typeof homeSearchSchema>

export const authSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  reason: z.enum(['expired', 'favorite', 'checkout']).optional().catch(undefined),
})
export type AuthSearch = z.infer<typeof authSearchSchema>

export const profileSearchSchema = z.object({
  section: z.enum(['dados', 'interesse']).optional().catch(undefined),
})
export type ProfileSearch = z.infer<typeof profileSearchSchema>
