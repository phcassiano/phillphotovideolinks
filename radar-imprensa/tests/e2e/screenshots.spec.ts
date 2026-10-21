import path from "node:path";
import { test } from "@playwright/test";

// Capturas de tela para documentação (dados fictícios do seed). Roda após mvp.spec.ts.
const out = (name: string) => path.join(__dirname, "../../docs/screenshots", name);

test("capturas de tela", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.screenshot({ path: out("01-inicio.png") });
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("assessora.e2e@agencia.example");
  await page.getByLabel("Senha").fill("senha-forte-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("/jornalistas?uf=RJ");
  await page.getByText(/jornalistas? encontrados?/).waitFor();
  await page.screenshot({ path: out("02-busca.png"), fullPage: true });
  await page.goto("/jornalistas/10000000-0000-4000-8000-000000000004");
  await page.getByRole("heading", { name: "Histórico profissional" }).waitFor();
  await page.screenshot({ path: out("03-perfil.png"), fullPage: true });
  await page.goto("/admin");
  await page.getByText("Jornalistas cadastrados").waitFor();
  await page.screenshot({ path: out("04-admin.png"), fullPage: true });
  await page.goto("/admin/revisoes");
  await page.getByRole("heading", { name: /Propostas de alteração/ }).waitFor();
  await page.screenshot({ path: out("05-revisoes.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/jornalistas?uf=PI");
  await page.waitForLoadState("networkidle");
  await page.getByText(/jornalistas? encontrados?/).waitFor();
  await page.screenshot({ path: out("06-busca-celular.png") });
});
