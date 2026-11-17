import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

const PUBLIC = ['/', '/explorar?q=pizza', '/categorias', '/brasilia/sobradinho', '/estabelecimento/pizzaria-forno-da-praca', '/anuncie', '/planos', '/login', '/cadastro', '/mapa'];

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('.leaflet-container') // tiles do OpenStreetMap
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
}

for (const path of PUBLIC) {
  test(`acessibilidade ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' });
    expect(await audit(page)).toEqual([]);
  });
}

test('acessibilidade do painel', async ({ page }) => {
  await login(page, ACCOUNTS.vitrine.email, ACCOUNTS.vitrine.password);
  for (const p of ['/painel', '/painel/estabelecimento', '/painel/produtos', '/painel/assinatura', '/painel/conta']) {
    await page.goto(p, { waitUntil: 'networkidle' });
    expect(await audit(page), p).toEqual([]);
  }
});

test('acessibilidade do admin', async ({ page }) => {
  await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  for (const p of ['/admin', '/admin/estabelecimentos', '/admin/assinaturas', '/admin/usuarios', '/admin/locais', '/admin/categorias', '/admin/planos']) {
    await page.goto(p, { waitUntil: 'networkidle' });
    expect(await audit(page), p).toEqual([]);
  }
});
