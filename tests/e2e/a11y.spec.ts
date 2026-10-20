import { expect, type Page, test } from '@playwright/test'
import { addToCart, login, mock, resetApp } from './helpers'

test.beforeEach(async ({ page }) => resetApp(page))

const focusInsideDialog = (page: Page) => page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))

test.describe('teclado e foco', () => {
  test('"Pular para o conteúdo" é o primeiro foco e leva ao conteúdo principal', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Atalho de teclado: validado no desktop.')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#main$/)
    await expect(page.locator('#main')).toBeFocused()
  })

  test('foco visível: elementos interativos exibem contorno ao receber foco por teclado', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Foco por teclado: validado no desktop.')
    await page.goto('/login')
    await page.getByLabel('E-mail', { exact: true }).focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      const s = getComputedStyle(el)
      return { tag: el.tagName, width: parseFloat(s.outlineWidth), style: s.outlineStyle, shadow: s.boxShadow }
    })
    expect(outline.tag).not.toBe('BODY')
    expect(outline.style !== 'none' || outline.shadow !== 'none').toBe(true)
  })

  test('diálogo de carteira: foco entra, fica preso, Esc fecha e devolve o foco ao gatilho', async ({ page }) => {
    await login(page, '/wallets')
    const trigger = page.getByRole('region', { name: 'Carteira secundária' }).getByRole('button', { name: 'Adicionar' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect.poll(() => focusInsideDialog(page)).toBe(true)

    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab')
      expect(await focusInsideDialog(page)).toBe(true)
    }
    await page.keyboard.press('Shift+Tab')
    expect(await focusInsideDialog(page)).toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('validação de formulário: erro anunciado e associado ao campo', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    const email = page.getByLabel('E-mail', { exact: true })
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const errorId = describedBy!.split(' ').find((id) => id.endsWith('-error'))
    expect(errorId).toBeTruthy()
    await expect(page.locator(`#${errorId}`)).toHaveAttribute('role', 'alert')
    await expect(page.locator(`#${errorId}`)).not.toBeEmpty()
  })
})

test.describe('carregamento lento e movimento reduzido', () => {
  test('catálogo: skeleton com shimmer enquanto carrega e conteúdo sem deslocar o layout', async ({ page }) => {
    await mock(page, (m) => m.setScenario({ latency: 'slow' }))
    await page.reload()
    const loading = page.getByLabel('Carregando NFTs')
    await expect(loading).toBeVisible()
    const shimmer = await loading.locator('.k-shimmer').first().evaluate((el) => getComputedStyle(el, '::after').animationName)
    expect(shimmer).toBe('k-shimmer')
    const before = await loading.boundingBox()
    await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 15_000 })
    await expect(loading).toBeHidden()
    const after = await page.getByTestId('catalog-grid').boundingBox()
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(2)
  })

  test('detalhe e carrinho mostram skeleton e depois o conteúdo', async ({ page }) => {
    await addToCart(page, 'nft-001')
    await mock(page, (m) => m.setScenario({ latency: 'slow' }))
    await page.goto('/nft/nft-002')
    await expect(page.getByLabel('Carregando NFT')).toBeVisible()
    await expect(page.getByTestId('detail-price')).toBeVisible({ timeout: 15_000 })

    await page.goto('/cart')
    await expect(page.getByLabel('Carregando carrinho')).toBeVisible()
    await expect(page.getByTestId('cart-item').first()).toBeVisible({ timeout: 15_000 })
  })

  test('movimento reduzido: o shimmer deixa de animar', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mock(page, (m) => m.setScenario({ latency: 'slow' }))
    await page.reload()
    const first = page.getByLabel('Carregando NFTs').locator('.k-shimmer').first()
    await expect(first).toBeVisible()
    const duration = await first.evaluate((el) => parseFloat(getComputedStyle(el, '::after').animationDuration))
    expect(duration).toBeLessThan(0.01)
  })
})
