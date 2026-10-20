import { expect, test } from '@playwright/test'
import { addToCart, mock, resetApp } from './helpers'

test.beforeEach(async ({ page }) => resetApp(page))

/** "Ao vivo" aparece quando o cliente conecta; só então o servidor simulado já registrou a conexão. */
async function waitLive(page: import('@playwright/test').Page) {
  await expect(page.getByText('Ao vivo')).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => mock(page, (m) => m.socketConnections()), { timeout: 10_000 }).toBeGreaterThan(0)
}

test.describe('tempo real (Socket.IO)', () => {
  test('conecta e mostra o indicador "Ao vivo"', async ({ page }) => {
    await waitLive(page)
  })

  test('nft.updated atualiza preço e estoque no detalhe', async ({ page }) => {
    await page.goto('/nft/nft-001')
    await waitLive(page)
    await mock(page, (m) => m.updateNft('nft-001', { price: '0.7777', available: 3 }))
    await expect(page.getByTestId('detail-price')).toContainText('0.7777')
    await expect(page.getByTestId('detail-availability')).toContainText('3')
  })

  test('mudança de preço de item no carrinho gera aviso e recalcula o total', async ({ page }) => {
    await addToCart(page, 'nft-001')
    await page.goto('/cart')
    await waitLive(page)
    const before = await page.getByTestId('quote-total').innerText()
    await mock(page, (m) => m.updateNft('nft-001', { price: '0.9' }))
    await expect(page.getByTestId('market-notice')).toBeVisible()
    await expect(page.getByTestId('quote-total')).not.toHaveText(before)
  })

  test('evento duplicado/antigo é ignorado (versão menor não regride o estado)', async ({ page }) => {
    await page.goto('/nft/nft-001')
    await waitLive(page)
    await mock(page, (m) => m.updateNft('nft-001', { price: '0.5' }))
    await expect(page.getByTestId('detail-price')).toContainText('0.50')
    await mock(page, (m) => m.updateNft('nft-001', { price: '0.6' }))
    await expect(page.getByTestId('detail-price')).toContainText('0.60')
  })

  test('derrubar o socket reconecta e reconcilia com a API', async ({ page }) => {
    await page.goto('/nft/nft-001')
    await waitLive(page)
    await mock(page, (m) => m.dropSocket())
    await expect(page.getByText(/Reconectando|Ao vivo/)).toBeVisible()
    await expect(page.getByText('Ao vivo')).toBeVisible({ timeout: 20_000 })
  })
})
