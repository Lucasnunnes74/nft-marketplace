/**
 * Aritmética de ETH sem ponto flutuante.
 *
 * Valores trafegam como strings decimais ("0.0125") e são calculados em wei
 * (bigint, 18 casas) para manter a precisão exata.
 */
const DECIMALS = 18
const SCALE = 10n ** BigInt(DECIMALS)

const DECIMAL_RE = /^\d+(\.\d{1,18})?$/

export function isEthString(value: string): boolean {
  return DECIMAL_RE.test(value)
}

export function toWei(value: string): bigint {
  if (!isEthString(value)) throw new Error(`Valor ETH inválido: "${value}"`)
  const [int, frac = ''] = value.split('.')
  return BigInt(int) * SCALE + BigInt(frac.padEnd(DECIMALS, '0'))
}

/** Converte wei para string decimal, removendo zeros à direita (mín. 1 casa não é exigida). */
export function fromWei(wei: bigint): string {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const int = abs / SCALE
  const frac = (abs % SCALE).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`
}

export function addEth(...values: string[]): string {
  return fromWei(values.reduce((acc, v) => acc + toWei(v), 0n))
}

export function subEth(a: string, b: string): string {
  return fromWei(toWei(a) - toWei(b))
}

export function mulEth(value: string, quantity: number): string {
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error('Quantidade inválida')
  return fromWei(toWei(value) * BigInt(quantity))
}

/** Percentual em pontos-base (1% = 100 bps). Arredonda para baixo. */
export function pctEth(value: string, basisPoints: number): string {
  return fromWei((toWei(value) * BigInt(basisPoints)) / 10_000n)
}

export function cmpEth(a: string, b: string): number {
  const x = toWei(a)
  const y = toWei(b)
  return x === y ? 0 : x > y ? 1 : -1
}

export function eqEth(a: string, b: string): boolean {
  return cmpEth(a, b) === 0
}

/** Formatação para a interface: no mínimo 2 e no máximo `max` casas, sem arredondar silenciosamente. */
export function formatEth(value: string, max = 4): string {
  const wei = toWei(value.startsWith('-') ? value.slice(1) : value)
  const sign = value.startsWith('-') ? '-' : ''
  const full = fromWei(wei)
  const [int, frac = ''] = full.split('.')
  const trimmed = frac.length > max ? frac.slice(0, max) : frac
  const padded = trimmed.padEnd(2, '0')
  const truncated = frac.length > max ? '…' : ''
  return `${sign}${int}.${padded}${truncated} ETH`
}
