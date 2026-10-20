import { expect, test } from '@playwright/test'
import { addToCart, connectWallet, expectCartCount, login, mock, resetApp } from './helpers'

test.beforeEach(async ({ page }) => resetApp(page))

test.describe('carrinho', () => {
  test('persiste após refresh e é preservado ao autenticar', async ({ page }) => {
    await addToCart(page, 'nft-001', 2)
    await page.reload()
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
    await expectCartCount(page, 2)

    await login(page, '/cart')
    await expect(page).toHaveURL(/\/cart/)
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
    await expectCartCount(page, 2)
  })

  test('cupom válido, inválido e expirado', async ({ page }) => {
    await addToCart(page, 'nft-001')
    const coupon = page.getByLabel('Código promocional')

    await coupon.fill('WELCOME10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('coupon-status')).toContainText('aplicado')
    await expect(page.getByTestId('quote-discount')).toBeVisible()

    await coupon.fill('EXPIRED20')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('coupon-status')).toContainText('expirou')

    await coupon.fill('QUALQUER')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('coupon-status')).toContainText('inválido')
  })

  test('alterar quantidade e remover item atualiza o total', async ({ page }) => {
    await addToCart(page, 'nft-001')
    const before = await page.getByTestId('quote-total').innerText()
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
    await expect(page.getByTestId('quote-total')).not.toHaveText(before)
    await page.getByRole('button', { name: /^Remover / }).click()
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })
})

test.describe('pagamento', () => {
  test.beforeEach(async ({ page }) => {
    await addToCart(page, 'nft-001')
    await login(page, '/checkout')
    await expect(page).toHaveURL(/\/checkout/)
  })

  test('fluxo feliz: conecta, confirma e mostra o recibo; carrinho esvazia', async ({ page }) => {
    await connectWallet(page)
    await page.getByTestId('confirm-order').click()
    await expect(page).toHaveURL(/\/orders\/ord_/)
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('order-tx')).toBeVisible()
    // Recibo sobrevive a refresh
    await page.reload()
    await expect(page.getByTestId('order-confirmed')).toBeVisible()
    await expectCartCount(page, 0)
  })

  test('exige carteira conectada antes de confirmar', async ({ page }) => {
    await page.getByTestId('confirm-order').click()
    await expect(page.getByText('Conecte a carteira para continuar')).toBeVisible()
    await expect(page).toHaveURL(/\/checkout/)
  })

  test('carteira recusa a conexão e depois conecta', async ({ page }) => {
    await mock(page, (m) => m.setScenario({ wallet: 'refused' }))
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByTestId('connect-error')).toBeVisible()
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByTestId('wallet-status')).toHaveText(/Carteira conectada/)
  })

  test('pagamento recusado mantém o carrinho e oferece nova tentativa', async ({ page }) => {
    await mock(page, (m) => m.setScenario({ payment: 'refused' }))
    await connectWallet(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-rejected')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('link', { name: 'Tentar novamente' })).toBeVisible()
    await expectCartCount(page, 1)
  })

  test('preço muda durante a compra: exige ciência do novo total', async ({ page }) => {
    await mock(page, (m) => m.setScenario({ priceChangeOnCheckout: true }))
    await connectWallet(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('price-changed')).toBeVisible()
    await expect(page.getByTestId('confirm-order')).toBeDisabled()
    await page.getByLabel('Estou ciente do novo total').check()
    await expect(page.getByTestId('confirm-order')).toBeEnabled()
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 15_000 })
  })

  test('item esgota durante a compra: bloqueia e leva ao carrinho', async ({ page }) => {
    await mock(page, (m) => m.setScenario({ soldOutOnCheckout: true }))
    await connectWallet(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('stock-issue')).toBeVisible()
  })

  const orderCount = (page: import('@playwright/test').Page) =>
    page.evaluate(() => Object.keys((JSON.parse(localStorage.getItem('nft.mockdb.v3') ?? '{}') as { orders?: object }).orders ?? {}).length)

  test('recarregar com pedido pendente recupera o estado sem criar outra compra', async ({ page }) => {
    await connectWallet(page)
    await page.getByTestId('confirm-order').click()
    await expect(page).toHaveURL(/\/orders\/ord_/)
    const url = page.url()
    await page.reload()
    await expect(page).toHaveURL(url)
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 15_000 })
    expect(await orderCount(page)).toBe(1)
  })

  test('conexão cai com pedido pendente: reconecta e mostra o resultado sem duplicar', async ({ page }) => {
    await connectWallet(page)
    await page.getByTestId('confirm-order').click()
    await expect(page).toHaveURL(/\/orders\/ord_/)
    await mock(page, (m) => m.dropSocket())
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 20_000 })
    expect(await orderCount(page)).toBe(1)
  })

  test('timeout na criação do pedido: recupera sem duplicar', async ({ page }) => {
    test.setTimeout(90_000)
    await mock(page, (m) => m.setScenario({ orderTimeout: true }))
    await connectWallet(page)
    await page.getByTestId('confirm-order').click()
    await expect(page).toHaveURL(/\/orders\/ord_/, { timeout: 40_000 })
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 15_000 })
  })

  test('sessão expira no checkout: volta ao login e retorna ao pagamento com o carrinho', async ({ page }) => {
    await mock(page, (m) => m.expireSessions())
    // A expiração pode ser detectada antes do clique (redireciona sozinha) ou na próxima chamada à API.
    await Promise.race([
      page.waitForURL(/\/login\?redirect=/),
      page.getByRole('button', { name: 'Conectar carteira' }).click({ timeout: 10_000 }).catch(() => {}),
    ])
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await page.getByLabel('E-mail').fill('demo@nft.test')
    await page.getByLabel('Senha', { exact: true }).fill('Demo@1234')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/checkout/)
    await expectCartCount(page, 1)
  })
})
