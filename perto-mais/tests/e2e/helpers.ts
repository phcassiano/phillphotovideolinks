import { expect, type Page } from '@playwright/test';

export const MAILPIT = 'http://127.0.0.1:54324';

export async function lastLinkFor(email: string, pathPart: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const list = (await res.json()) as { messages?: { ID: string }[] };
    const id = list.messages?.[0]?.ID;
    if (id) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { HTML: string };
      const m = new RegExp(`href="([^"]*${pathPart}[^"]*)"`).exec(msg.HTML);
      if (m) return m[1]!.replace(/&amp;/g, '&');
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`E-mail para ${email} não chegou`);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/painel/);
}

export const ACCOUNTS = {
  admin: { email: 'admin@perto.local', password: 'Perto+Admin123' },
  gratuito: { email: 'gratuito@perto.local', password: 'Perto+Teste123' },
  vitrine: { email: 'vitrine@perto.local', password: 'Perto+Teste123' },
};
