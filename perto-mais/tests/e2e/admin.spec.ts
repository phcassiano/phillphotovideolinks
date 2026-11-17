import { expect, test } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

test.describe.configure({ mode: 'serial' });
// eslint-disable-next-line no-empty-pattern -- Playwright exige o primeiro argumento de fixtures
test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'altera dados; roda uma vez'));

test('comerciante não acessa /admin', async ({ page }) => {
  await login(page, ACCOUNTS.gratuito.email, ACCOUNTS.gratuito.password);
  const res = await page.goto('/admin');
  expect(res?.status()).toBe(403);
});

test('admin vê o painel e aprova um cadastro pendente', async ({ page }) => {
  await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  await page.goto('/admin');
  await expect(page.getByText('Receita recorrente mensal')).toBeVisible();
  await expect(page.getByText(/R\$\s?\d/).first()).toBeVisible();

  await page.goto('/admin/estabelecimentos?status=pending');
  await page.getByRole('link', { name: /Oficina Roda Viva/ }).click();
  await page.getByRole('button', { name: 'Aprovar' }).click();
  await expect(page.getByText('Situação atualizada.').first()).toBeVisible();
  await expect(page.getByText('Aprovado', { exact: true })).toBeVisible();
  const res = await page.goto('/estabelecimento/oficina-roda-viva');
  expect(res?.status()).toBe(200);
});

test('admin rejeita com motivo e destaca por período', async ({ page }) => {
  await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  await page.goto('/admin/estabelecimentos?status=pending');
  await page.getByRole('link', { name: /Contabilidade Prumo/ }).click();
  await page.getByRole('button', { name: 'Rejeitar' }).click();
  await page.getByLabel('Motivo').fill('Faltou informar o endereço completo.');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Faltou informar o endereço completo.')).toBeVisible();

  await page.goto('/admin/estabelecimentos?status=approved');
  await page.getByRole('link', { name: /Farmácia Bem Viver/ }).click();
  await page.getByRole('button', { name: 'Destacar' }).click();
  await expect(page.getByText('Destaque programado.').first()).toBeVisible();

  await page.goto('/admin/log');
  await expect(page.getByText('businesses.update').first()).toBeVisible();
});

test('admin ativa assinatura pendente e o negócio ganha Vitrine', async ({ page }) => {
  await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  await page.goto('/admin/assinaturas?status=pending');
  const row = page.getByRole('listitem').filter({ hasText: 'Farmácia Bem Viver' });
  await row.getByRole('button', { name: 'Ativar' }).click();
  await page.getByLabel('Observação').fill('Pix recebido (teste E2E)');
  await page.getByRole('button', { name: 'Ativar' }).last().click();
  await expect(page.getByText('Assinatura ativada.').first()).toBeVisible();
  await page.goto('/admin');
  await expect(page.getByText('Com Vitrine (premium)')).toBeVisible();
});

test('admin cria subcategoria', async ({ page }) => {
  await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  await page.goto('/admin/categorias');
  const section = page.locator('section').filter({ hasText: 'Pet shops' });
  await section.getByRole('button', { name: 'Subcategoria' }).click();
  const name = `Banho e tosa ${Date.now() % 10000}`;
  await page.getByLabel('Nome').fill(name);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Categoria salva.').first()).toBeVisible();
  await expect(page.getByText(name)).toBeVisible();
});
