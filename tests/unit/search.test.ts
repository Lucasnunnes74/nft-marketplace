import { describe, expect, it } from 'vitest'
import { homeSearchSchema, parseSearch, stringifySearch } from '@/search-schemas'

describe('busca do catálogo na URL', () => {
  it('mantém preços como string, sem perder casas decimais', () => {
    const parsed = parseSearch('?minPrice=0.10&maxPrice=0.123456789012345678&page=2')
    expect(parsed.minPrice).toBe('0.10')
    expect(parsed.maxPrice).toBe('0.123456789012345678')
    expect(parsed.page).toBe(2)
  })

  it('não converte notação científica em número válido', () => {
    const search = homeSearchSchema.parse(parseSearch('?minPrice=1e-7&maxPrice=abc'))
    expect(search.minPrice).toBeUndefined()
    expect(search.maxPrice).toBeUndefined()
  })

  it('escreve preços crus e faz ida e volta sem alterar o valor', () => {
    const search = { q: 'ape', minPrice: '0.10', maxPrice: '2', page: 3 }
    const url = stringifySearch(search)
    expect(url).toContain('minPrice=0.10')
    expect(url).toContain('maxPrice=2')
    expect(url).not.toContain('%22')
    expect(homeSearchSchema.parse(parseSearch(url))).toEqual(search)
  })

  it('devolve string vazia sem parâmetros', () => {
    expect(stringifySearch({})).toBe('')
  })
})
