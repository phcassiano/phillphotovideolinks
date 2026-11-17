import { expect, test } from '@playwright/test';
import { ACCOUNTS, lastLinkFor, login } from './helpers';

test.describe.configure({ mode: 'serial' });

test('cadastro com confirmação de e-mail e painel em análise', async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'fluxo longo roda só uma vez');
  const email = `novo-${Date.now()}@teste.local`;
  await page.goto('/cadastro');
  await page.getByLabel('Seu nome').fill('Maria Teste');
  await page.getByLabel('Seu telefone').fill('(61) 98888-1234');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('SenhaBoa123');
  await page.getByLabel('Nome do negócio').fill('Doceria Teste E2E');
  await page.getByLabel('Categoria').selectOption({ label: 'Lanchonetes' });
  await page.getByLabel('Bairro').selectOption({ label: 'Sobradinho' });
  await page.getByLabel('Endereço').fill('Quadra 1, Loja 1');
  await page.getByLabel('WhatsApp do negócio').fill('61 97777-1234');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar conta e cadastrar' }).click();
  await expect(page.getByRole('heading', { name: 'Confirme seu e-mail' })).toBeVisible();

  const link = await lastLinkFor(email, '/auth/confirmar');
  await page.goto(link.replace(/^https?:\/\/[^/]+/, baseURL!));
  await expect(page).toHaveURL(/\/painel\?confirmado=1/);
  await expect(page.getByText('Em análise')).toBeVisible();
});

test('validação no cliente mostra erros em português', async ({ page }) => {
  await page.goto('/cadastro');
  await page.getByRole('button', { name: 'Criar conta e cadastrar' }).click();
  await expect(page.getByText('Informe seu nome.')).toBeVisible();
  await expect(page.getByText('É preciso aceitar os termos.')).toBeVisible();
});

test('comerciante gratuito edita dados e vê bloqueios da Vitrine', async ({ page }) => {
  await login(page, ACCOUNTS.gratuito.email, ACCOUNTS.gratuito.password);
  await expect(page.getByText('Publicado')).toBeVisible();
  await expect(page.getByText('últimos 30 dias')).toBeVisible();
  await page.goto('/painel/estabelecimento');
  await page.getByLabel('Endereço').fill('Quadra 8, Conjunto A, Loja 1-A');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText('Dados salvos.').first()).toBeVisible();
  await expect(page.getByText('Disponível no plano Vitrine.').first()).toBeVisible();
});
