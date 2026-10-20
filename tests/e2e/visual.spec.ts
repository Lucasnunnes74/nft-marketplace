import { expect, test } from '@playwright/test'
import { addToCart, login, resetApp } from './helpers'

/**
 * Regressão visual. Primeira execução: `npm run test:e2e:update` para gerar baselines.
 * Áreas dinâmicas (indicador ao vivo, painel de simulação) são mascaradas.
 */
test.beforeEach(async ({ page }) => resetApp(page))

const masks = (page: import('@playwright/test').Page) => [page.getByTestId('mock-panel'), page.getByText(/Ao vivo|Conectando|Reconectando|Offline/)]

test('início', async ({ page }) => {
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('home.png', { fullPage: true, mask: masks(page) })
})

test('detalhe do NFT', async ({ page }) => {
  await page.goto('/nft/nft-002')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('detail.png', { fullPage: true, mask: masks(page) })
})

test('carrinho', async ({ page }) => {
  await addToCart(page, 'nft-001')
  await page.goto('/cart')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('cart.png', { fullPage: true, mask: masks(page) })
})

test('pagamento', async ({ page }) => {
  await addToCart(page, 'nft-001')
  await login(page, '/checkout')
  await expect(page).toHaveURL(/\/checkout/)
  await expect(page.getByTestId('confirm-order')).toBeVisible()
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('checkout.png', { fullPage: true, mask: masks(page) })
})

test('login', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveScreenshot('login.png', { mask: masks(page) })
})
