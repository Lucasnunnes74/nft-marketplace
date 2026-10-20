import { expect, type Page, test } from '@playwright/test'
import { addToCart, login, resetApp } from './helpers'

/**
 * Larguras exigidas pelo desafio (390, 768 e 1440 px) mais 320 px, que equivale a 400% de zoom
 * em 1280 px (WCAG 1.4.10). Roda só no projeto desktop, que permite redimensionar a janela.
 */
const widths = [320, 390, 768, 960, 1152, 1440]

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Redimensiona a janela; basta uma execução.')
  await resetApp(page)
})

async function expectNoHorizontalOverflow(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, `${path} estoura a largura (${scrollWidth} > ${clientWidth})`).toBeLessThanOrEqual(clientWidth)
}

for (const width of widths) {
  test.describe(`${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
    })

    test('telas públicas sem rolagem horizontal', async ({ page }) => {
      for (const path of ['/', '/nft/nft-002', '/cart', '/login', '/signup']) await expectNoHorizontalOverflow(page, path)
    })

    // O miolo dos cards de destaque é fixo (arte + texto): o grid só pode ter 2 colunas quando cabem.
    test('cards de destaque sem imagem sobre o texto', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      const cards = page.locator('#destaques article')
      for (let i = 0; i < (await cards.count()); i++) {
        const image = cards.nth(i).locator('img[src$="-sm.webp"]')
        if (!(await image.isVisible())) continue
        const a = (await image.boundingBox())!
        const b = (await cards.nth(i).locator('h2').boundingBox())!
        const overlaps = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
        expect(overlaps, `card ${i} a ${width}px: arte sobre o título`).toBe(false)
      }
    })

    test('telas privadas sem rolagem horizontal', async ({ page }) => {
      await addToCart(page, 'nft-001')
      await login(page, '/profile')
      await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
      for (const path of ['/profile', '/wallets', '/cart', '/checkout']) await expectNoHorizontalOverflow(page, path)
    })
  })
}
