import { expect, test } from '@playwright/test';
import path from 'node:path';
import { ACCOUNTS, login } from './helpers';

test.describe.configure({ mode: 'serial' });

test('Vitrine: cadastra produto com foto e ele aparece no cardápio público', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'altera dados; roda uma vez');
  const name = `Pizza E2E ${Date.now()}`;
  await login(page, ACCOUNTS.vitrine.email, ACCOUNTS.vitrine.password);
  await page.goto('/painel/produtos');
  await page.getByRole('button', { name: 'Novo produto' }).click();
  const dialog = page.getByRole('dialog', { name: 'Novo produto' });
  await dialog.getByLabel('Nome').fill(name);
  await dialog.getByLabel('Preço (R$)').fill('39,90');
  await dialog.getByLabel('Seção').selectOption({ label: 'Pizzas' });
  await dialog.locator('input[type=file]').setInputFiles(path.join(import.meta.dirname, 'fixtures/foto.jpg'));
  await dialog.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Produto adicionado.').first()).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  await page.goto('/estabelecimento/pizzaria-forno-da-praca');
  const item = page.getByRole('button', { name: new RegExp(name) });
  await expect(item).toBeVisible();
  await expect(item).toContainText('R$ 39,90');
  await item.click();
  await expect(page.getByRole('dialog', { name })).toBeVisible();
  const img = page.getByRole('dialog', { name }).getByRole('img');
  await expect(img).toHaveAttribute('src', /\/storage\/v1\/object\/public\/business-media\/.+\/product\/.+\.webp$/);
});

test('Gratuito: produtos bloqueados e solicitação da Vitrine fica pendente', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'altera dados; roda uma vez');
  await login(page, ACCOUNTS.gratuito.email, ACCOUNTS.gratuito.password);
  await page.goto('/painel/produtos');
  await expect(page.getByText('Catálogo e cardápio fazem parte da Vitrine')).toBeVisible();
  await page.goto('/painel/assinatura');
  const cancel = page.getByRole('button', { name: 'Cancelar solicitação' });
  if (await cancel.isVisible()) await cancel.click();
  await page.getByRole('button', { name: /Solicitar o plano Vitrine/ }).click();
  await expect(page.getByText(/Solicitação do plano Vitrine em análise/)).toBeVisible();
  await expect(page.getByText('Aguardando pagamento')).toBeVisible();
});
