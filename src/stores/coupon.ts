import { createStore } from './create-store'

const KEY = 'nft.coupon'

function read() {
  try {
    return sessionStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

/** Cupom aplicado: persiste na aba (refresh e do carrinho ao pagamento). */
export const couponStore = createStore<string>(read())

export function setCoupon(code: string) {
  const value = code.trim().toUpperCase()
  couponStore.set(value)
  try {
    if (value) sessionStorage.setItem(KEY, value)
    else sessionStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}
