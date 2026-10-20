import { expect, test } from '@playwright/test'
import { favoriteButton, filterButton, isMobile, login, mock, pickFilter, resetApp, search } from './helpers'

test.beforeEach(async ({ page }) => resetApp(page))

test.describe('catálogo', () => {
  test('busca, filtros e ordenação ficam na URL e sobrevivem a refresh', async ({ page }) => {
    test.setTimeout(90_000)
    await search(page, 'jade')
    await expect(page).toHaveURL(/q=jade/)
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(1)

    await page.getByLabel('Buscar').fill('')
    await expect(page).not.toHaveURL(/q=/)
    await pickFilter(page, /^Jogos/)
    await expect(page).toHaveURL(/category=gaming/)
    if (!isMobile(page)) {
      await page.getByLabel('Ordenar por').selectOption('price_desc')
      await expect(page).toHaveURL(/sort=price_desc/)
    }

    await page.reload()
    if (!isMobile(page)) await expect(page.getByLabel('Ordenar por')).toHaveValue('price_desc')
    await expect(await filterButton(page, /^Jogos/)).toHaveAttribute('aria-pressed', 'true')
  })

  test('abas "Novos lançamentos" e "Em alta" filtram o catálogo pela URL', async ({ page }) => {
    await page.getByRole('link', { name: 'Em alta' }).click()
    await expect(page).toHaveURL(/tab=trending/)
    await expect(page.getByRole('link', { name: 'Em alta' })).toHaveAttribute('aria-current', 'page')
    await page.getByRole('link', { name: 'Todos os NFTs' }).click()
    await expect(page).not.toHaveURL(/tab=/)
  })

  test('paginação, voltar do histórico e mudança de filtro reinicia a página', async ({ page }) => {
    await page.getByRole('link', { name: 'Próxima página' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByTestId('page-indicator')).toContainText('Página 2')

    await page.goBack()
    await expect(page).not.toHaveURL(/page=2/)

    await page.getByRole('link', { name: 'Próxima página' }).click()
    await expect(page).toHaveURL(/page=2/)
    await pickFilter(page, /^Arte digital/)
    await expect(page).not.toHaveURL(/page=/)
  })

  test('sem resultados mostra estado vazio com ação para limpar', async ({ page }) => {
    await search(page, 'zzzz-inexistente')
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    await page.getByRole('button', { name: 'Limpar filtros' }).last().click()
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
  })

  test('falha de API mostra erro com retry e recupera', async ({ page }) => {
    await page.evaluate(() => (window as unknown as { __mock: { setScenario: (p: object) => void } }).__mock.setScenario({ failure: '503' }))
    await pickFilter(page, /^Música/)
    await expect(page.getByRole('alert').filter({ hasText: /indisponível/i }).first()).toBeVisible({ timeout: 20_000 })

    await page.evaluate(() => (window as unknown as { __mock: { setScenario: (p: object) => void } }).__mock.setScenario({ failure: 'none' }))
    await page.getByRole('button', { name: 'Tentar novamente' }).first().click()
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
  })

  test('detalhe: NFT inexistente e esgotado', async ({ page }) => {
    await page.goto('/nft/nft-999')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()

    await page.goto('/nft/nft-011')
    await expect(page.getByTestId('detail-availability')).toContainText('Esgotado')
    await expect(page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ })).toHaveCount(0)
  })

  test('favoritos: falha da mutation reverte o estado e a nova tentativa funciona', async ({ page }) => {
    const name = 'Emerald Ape #042'
    await login(page, '/nft/nft-001')
    await expect(favoriteButton(page, name)).toHaveAttribute('aria-pressed', 'false')

    await mock(page, (m) => m.setScenario({ failure: '500' }))
    await favoriteButton(page, name).click()
    await expect(page.getByText('Não foi possível atualizar o favorito')).toBeVisible()
    await expect(favoriteButton(page, name)).toHaveAttribute('aria-pressed', 'false')

    await mock(page, (m) => m.setScenario({ failure: 'none' }))
    const saved = page.waitForResponse((r) => r.url().includes('/api/favorites') && r.request().method() === 'POST')
    await favoriteButton(page, name).click()
    await saved
    await expect(favoriteButton(page, name)).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(favoriteButton(page, name)).toHaveAttribute('aria-pressed', 'true')
  })

  test('favoritos exigem login e voltam ao ponto de origem', async ({ page }) => {
    const name = 'Emerald Ape #042'
    await page.goto('/nft/nft-001')
    await favoriteButton(page, name).click()
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await page.getByLabel('E-mail', { exact: true }).fill('demo@nft.test')
    await page.getByLabel('Senha', { exact: true }).fill('Demo@1234')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/nft\/nft-001/)
    // Espera os dados do usuário recém-logado (isFavorite) antes de alternar.
    await page.waitForLoadState('networkidle')
    await expect(favoriteButton(page, name)).toHaveAttribute('aria-pressed', 'false')
    // O botão atualiza de forma otimista; só recarrega depois que o servidor confirmou.
    const saved = page.waitForResponse((r) => r.url().includes('/api/favorites') && r.request().method() === 'POST')
    await favoriteButton(page, name).click()
    await saved
    await expect(favoriteButton(page, name)).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(favoriteButton(page, name)).toHaveAttribute('aria-pressed', 'true')
  })
})
