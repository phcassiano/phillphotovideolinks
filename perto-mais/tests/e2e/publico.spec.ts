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
  const res = await page.goto('/estabelecimento/assistencia-celular-conecta');
  expect(res?.status()).toBe(404);
});

test('robots, sitemap, manifest e canonical', async ({ page, request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /painel');
  expect(robots).toContain('Disallow: /admin');
  expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.headers()['content-type']).toContain('xml');
  expect(await sitemap.text()).not.toContain('oficina-roda-viva'); // pendente/demonstração fora
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.icons.length).toBeGreaterThan(1);
  await page.goto('/brasilia/sobradinho');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/brasilia\/sobradinho$/);
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((t) => t.includes('BreadcrumbList'))).toBe(true);
});

test('mapa mostra agrupamentos e o resumo ao tocar no pino', async ({ page }) => {
  await page.goto('/brasilia/sobradinho'); // define o bairro
  await page.goto('/mapa');
  const marker = page.locator('.leaflet-marker-icon').first();
  await expect(marker).toBeVisible({ timeout: 15000 });
  // aproxima até aparecerem pinos individuais
  for (let i = 0; i < 6 && (await page.locator('.leaflet-marker-icon[title]').count()) === 0; i++) {
    await page.locator('.leaflet-marker-icon').first().click();
    await page.waitForTimeout(600);
  }
  await page.locator('.leaflet-marker-icon[title]').first().click();
  await expect(page.getByRole('dialog', { name: /Resumo de/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver página' })).toBeVisible();
});
