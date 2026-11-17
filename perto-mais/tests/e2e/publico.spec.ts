import { expect, test } from '@playwright/test';

test('home mostra título, busca e categorias', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Seu bairro inteiro');
  await expect(page.getByRole('heading', { name: 'Categorias' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Como funciona' })).toBeVisible();
});

test('busca sem acento encontra açaí', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('O que você está procurando?').first().fill('acai');
  await page.getByPlaceholder('O que você está procurando?').first().press('Enter');
  await expect(page).toHaveURL(/explorar\?q=acai/);
  await expect(page.getByRole('link', { name: 'Açaí Ponto Roxo', exact: true })).toBeVisible();
});

test('escolher bairro e abrir listagem por categoria', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Localização:/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Onde você está?' });
  await dialog.getByRole('button', { name: 'Sobradinho', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /Localização: Sobradinho, Brasília/ }).first()).toBeVisible();
  await page.goto('/brasilia/sobradinho/pizzarias');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Pizzarias em Sobradinho');
  await expect(page.getByRole('link', { name: 'Pizzaria Forno da Praça', exact: true })).toBeVisible();
});

test('página do estabelecimento: SEO, cardápio e aviso de demonstração', async ({ page }) => {
  await page.goto('/estabelecimento/pizzaria-forno-da-praca');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pizzaria Forno da Praça');
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((t) => t.includes('"LocalBusiness"'))).toBe(true);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /capa\.webp/);
  await expect(page.getByRole('heading', { name: 'Cardápio' })).toBeVisible();
  await page.getByRole('link', { name: /FALAR PELO WHATSAPP/ }).click();
  await expect(page.getByRole('dialog', { name: 'Estabelecimento de demonstração' })).toBeVisible();
});

test('combinação vazia recebe noindex e chamada para anunciar', async ({ page }) => {
  await page.goto('/brasilia/planaltina/barbearias');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('link', { name: 'Anunciar meu negócio' }).first()).toBeVisible();
});

test('pendentes não aparecem publicamente', async ({ page }) => {
  const res = await page.goto('/estabelecimento/oficina-roda-viva');
  expect(res?.status()).toBe(404);
});
