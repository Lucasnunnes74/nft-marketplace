import { describe, expect, it } from 'vitest'
import { addEth, cmpEth, formatEth, fromWei, mulEth, pctEth, subEth, toWei } from '@/lib/eth'

describe('aritmética de ETH (sem ponto flutuante)', () => {
  it('soma sem erro de arredondamento', () => {
    expect(0.1 + 0.2).not.toBe(0.3) // o problema que evitamos
    expect(addEth('0.1', '0.2')).toBe('0.3')
  })

  it('multiplica por quantidade inteira', () => {
    expect(mulEth('0.0125', 3)).toBe('0.0375')
    expect(() => mulEth('1', 1.5)).toThrow()
  })

  it('aplica percentual em pontos-base', () => {
    expect(pctEth('0.5', 1000)).toBe('0.05') // 10%
    expect(subEth('0.5', '0.05')).toBe('0.45')
  })

  it('mantém 18 casas e compara exatamente', () => {
    expect(fromWei(toWei('0.000000000000000001'))).toBe('0.000000000000000001')
    expect(cmpEth('0.1', '0.10')).toBe(0)
    expect(cmpEth('1', '0.999999999999999999')).toBe(1)
  })

  it('formata para exibição sem arredondar em silêncio', () => {
    expect(formatEth('1.2')).toBe('1.20 ETH')
    expect(formatEth('0.123456')).toBe('0.1234… ETH')
  })

  it('rejeita valores inválidos', () => {
    expect(() => toWei('abc')).toThrow()
    expect(() => toWei('-1')).toThrow()
  })
})
