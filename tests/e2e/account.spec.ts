import { expect, test } from '@playwright/test'
import { addToCart, expectCartCount, login, loginAs, logout, mock, resetApp } from './helpers'

test.beforeEach(async ({ page }) => resetApp(page))

// PNG 1×1 válido (68 bytes).
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const VALID_ADDRESS = `0x${'ab'.repeat(20)}`

test.describe('cadastro e sessão', () => {
  test('valida o formulário e mostra erros associados aos campos', async ({ page }) => {
    await page.goto('/signup')
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
    await expect(page.getByRole('alert').first()).toBeVisible()
    await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true')

    await page.locator('#name').fill('Carla Teste')
    await page.locator('#email').fill('carla@nft.test')
    await page.locator('#password').fill('Teste@1234')
    await page.locator('#confirm').fill('Outra@1234')
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
    await expect(page.getByText('As senhas não coincidem')).toBeVisible()
  })

  test('e-mail já cadastrado vira erro no campo; cadastro válido abre a sessão', async ({ page }) => {
    await page.goto('/signup')
    await page.locator('#name').fill('Carla Teste')
    await page.locator('#email').fill('demo@nft.test')
    await page.locator('#password').fill('Teste@1234')
    await page.locator('#confirm').fill('Teste@1234')
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
    await expect(page.getByText('Este e-mail já está cadastrado.')).toBeVisible()
    await expect(page).toHaveURL(/\/signup/)

    await page.locator('#email').fill('carla@nft.test')
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
    await expect(page).toHaveURL(/\/$/)
    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
    await expect(page.locator('#p-email')).toHaveValue('carla@nft.test')
  })

  test('faixa de base do diálogo acompanha o fim do conteúdo, sem cruzar o formulário', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Diálogo de acesso é o layout desktop.')
    await page.setViewportSize({ width: 1440, height: 520 }) // janela baixa (ex.: zoom): o painel rola
    await page.goto('/signup')
    const dialog = page.getByRole('dialog')
    await dialog.evaluate((el) => el.scrollTo(0, el.scrollHeight))
    const strip = (await dialog.getByTestId('auth-bottom-bar').boundingBox())!
    const submit = (await dialog.getByRole('button', { name: 'Criar conta' }).boundingBox())!
    const panel = (await dialog.boundingBox())!
    expect(strip.y).toBeGreaterThanOrEqual(submit.y + submit.height) // abaixo do botão
    expect(Math.abs(strip.y + strip.height - (panel.y + panel.height))).toBeLessThan(2) // colada na base do painel
  })

  test('login com senha errada mostra erro e permanece na tela', async ({ page }) => {
    await loginAs(page, 'demo@nft.test', 'Errada@123')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('alert').first()).toBeVisible()
  })

  test('sessão expirada durante a navegação volta ao login e retorna ao ponto de origem', async ({ page }) => {
    await login(page, '/wallets')
    await expect(page).toHaveURL(/\/wallets/)
    await mock(page, (m) => m.expireSessions())
    await page.reload()
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await loginAs(page, 'demo@nft.test', 'Demo@1234', '/wallets')
    await expect(page).toHaveURL(/\/wallets/)
  })

  test('logout e troca de usuário não vazam carrinho nem favoritos', async ({ page }) => {
    await login(page)
    await expect(page).toHaveURL(/\/$/)
    await addToCart(page, 'nft-001')
    await page.goto('/profile?section=interesse')
    await expect(page.getByTestId('favorites-grid')).toBeVisible()

    await logout(page)
    await expectCartCount(page, 0)
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login\?redirect=/)

    await loginAs(page, 'ana@nft.test', 'Demo@1234', '/profile?section=interesse')
    await expect(page.getByText('Nenhum favorito ainda')).toBeVisible()
    await expect(page.getByTestId('favorites-grid')).toHaveCount(0)
    await expectCartCount(page, 0)
  })
})

test.describe('perfil', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, '/profile')
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  })

  test('edita dados e a alteração permanece após refresh', async ({ page }) => {
    await page.locator('#p-name').fill('Demo Atualizado')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Alterações salvas')).toBeVisible()
    await page.reload()
    await expect(page.locator('#p-name')).toHaveValue('Demo Atualizado')
  })

  test('valida e-mail e conflito retornado pela API', async ({ page }) => {
    await page.locator('#p-email').fill('invalido')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('E-mail inválido')).toBeVisible()

    await page.locator('#p-email').fill('ana@nft.test')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Este e-mail já está em uso por outra conta.')).toBeVisible()
  })

  test('avatar: rejeita arquivo inválido e grande, aceita imagem e persiste', async ({ page }) => {
    const input = page.getByLabel('Enviar foto de perfil')

    await input.setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') })
    await expect(page.getByText('Envie um arquivo de imagem.')).toBeVisible()

    await input.setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: Buffer.alloc(200 * 1024) })
    await expect(page.getByText('A imagem deve ter até 150 KB.')).toBeVisible()

    await input.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: TINY_PNG })
    await expect(page.locator('form').getByAltText('Foto de perfil')).toBeVisible()
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Alterações salvas')).toBeVisible()
    await page.reload()
    await expect(page.locator('form').getByAltText('Foto de perfil')).toBeVisible()
  })

  test('senha: valida confirmação, recusa senha atual errada e troca com sucesso', async ({ page }) => {
    await page.locator('#pw-current').fill('Demo@1234')
    await page.locator('#pw-new').fill('Nova@1234')
    await page.locator('#pw-confirm').fill('Diferente@1')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('As senhas não coincidem')).toBeVisible()

    await page.locator('#pw-current').fill('Errada@123')
    await page.locator('#pw-confirm').fill('Nova@1234')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Senha atual incorreta.')).toBeVisible()

    await page.locator('#pw-current').fill('Demo@1234')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Alterações salvas')).toBeVisible()

    await logout(page)
    await loginAs(page, 'demo@nft.test', 'Demo@1234')
    await expect(page).toHaveURL(/\/login/)
    await loginAs(page, 'demo@nft.test', 'Nova@1234')
    await expect(page).toHaveURL(/\/$/)
  })
})

test.describe('carteiras', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, '/wallets')
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
  })

  const addSecondary = (page: import('@playwright/test').Page) =>
    page.getByRole('region', { name: 'Carteira secundária' }).getByRole('button', { name: 'Adicionar' })

  test('cadastra carteira secundária com validação, bloqueia duplicada e mantém após refresh', async ({ page }) => {
    await addSecondary(page).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('#d-label').fill('Cofre')
    await dialog.locator('#d-address').fill('0x123')
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog.getByText(/Endereço inválido/)).toBeVisible()

    await dialog.locator('#d-address').fill(VALID_ADDRESS)
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByTestId('wallet-list')).toContainText('Cofre')

    await addSecondary(page).click()
    await page.getByRole('dialog').locator('#d-label').fill('Cofre 2')
    await page.getByRole('dialog').locator('#d-address').fill(VALID_ADDRESS)
    await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Esta carteira já está cadastrada.')).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()

    await page.reload()
    await expect(page.getByTestId('wallet-list')).toContainText('Cofre')
  })

  test('edita a carteira principal e torna a secundária principal', async ({ page }) => {
    await page.locator('#w-label').fill('Principal renomeada')
    await page.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira atualizada').first()).toBeVisible()

    await addSecondary(page).click()
    await page.getByRole('dialog').locator('#d-label').fill('Cofre')
    await page.getByRole('dialog').locator('#d-address').fill(VALID_ADDRESS)
    await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByTestId('wallet-list')).toContainText('Cofre')

    await page.getByTestId('wallet-list').getByRole('listitem').filter({ hasText: 'Cofre' }).getByRole('button', { name: 'Tornar principal' }).click()
    await expect(page.getByText('Carteira principal atualizada')).toBeVisible()
    await expect(page.locator('#w-label')).toHaveValue('Cofre')
    await expect(page.getByTestId('wallet-list')).toContainText('Principal renomeada')
  })
})
