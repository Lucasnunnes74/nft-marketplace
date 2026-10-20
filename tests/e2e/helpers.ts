import { expect, type Page } from '@playwright/test'

type MockControl = {
  setScenario: (patch: Record<string, unknown>) => void
  updateNft: (id: string, patch: { price?: string; available?: number }) => unknown
  expireSessions: () => void
  dropSocket: () => void
  socketConnections: () => number
  reset: () => void
}

export async function mock<T>(page: Page, fn: (m: MockControl) => T): Promise<T> {
  return page.evaluate(`(${fn.toString()})(window.__mock)`) as Promise<T>
}

/** Layout mobile (Pixel 7): filtros em folha, sem ordenação visível, tab bar só no início/conta. */
export function isMobile(page: Page) {
  return (page.viewportSize()?.width ?? 1440) < 768
}

/** Restaura o estado conhecido (banco simulado, sessão e cenário) e recarrega. */
export async function resetApp(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as unknown as { __mock?: unknown }).__mock))
  await mock(page, (m) => m.reset())
  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as unknown as { __mock?: unknown }).__mock))
  // Tolerante a servidor de desenvolvimento frio (primeira carga reotimiza dependências).
  await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeAttached({ timeout: 30_000 })
  await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 30_000 })
}

export async function login(page: Page, redirect?: string) {
  await loginAs(page, 'demo@nft.test', 'Demo@1234', redirect)
}

/** Usuários de demonstração: demo@nft.test (com carteira e favorito) e ana@nft.test (sem favoritos). */
export async function loginAs(page: Page, email: string, password = 'Demo@1234', redirect?: string) {
  await page.goto(redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login')
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

/** Encerra a sessão pelo menu da conta (Perfil → Sair). */
export async function logout(page: Page) {
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/$/)
}

/** Busca do catálogo: no desktop fica atrás do ícone de lupa do cabeçalho. */
export async function search(page: Page, text: string) {
  const open = page.getByRole('button', { name: 'Abrir busca' })
  if (await open.isVisible()) await open.click()
  await page.getByLabel('Buscar').fill(text)
}

/** Clica num filtro da barra lateral (no mobile, dentro da folha "Abrir filtros"). */
export async function pickFilter(page: Page, name: RegExp) {
  if (isMobile(page)) await page.getByRole('button', { name: 'Abrir filtros' }).click()
  await page.getByRole('button', { name }).click()
}

export async function filterButton(page: Page, name: RegExp) {
  if (isMobile(page)) await page.getByRole('button', { name: 'Abrir filtros' }).click()
  return page.getByRole('button', { name })
}

/** "COMPRAR" (desktop) / "Comprar NFT" (mobile) adiciona a quantidade escolhida e abre o carrinho. */
export async function addToCart(page: Page, nftId: string, quantity = 1) {
  await page.goto(`/nft/${nftId}`)
  for (let i = 1; i < quantity; i++) await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ }).click()
  await expect(page).toHaveURL(/\/cart/)
  await expect(page.getByTestId('cart-item').first()).toBeVisible()
}

/** Contador do carrinho no cabeçalho (desktop) ou na tab bar do início (mobile). */
export async function expectCartCount(page: Page, count: number) {
  if (isMobile(page)) await page.goto('/')
  const badge = page.getByTestId('cart-count')
  if (count === 0) await expect(badge).toHaveCount(0)
  else await expect(badge).toHaveText(String(count))
}

export async function connectWallet(page: Page) {
  await page.goto('/checkout')
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByTestId('wallet-status')).toHaveText(/Carteira conectada/)
}

export function favoriteButton(page: Page, name: string) {
  return page.getByRole('button', {
    name: new RegExp(`^(Favoritar|Favoritado|Favoritar ${name}|Remover ${name} dos favoritos)$`),
  })
}
