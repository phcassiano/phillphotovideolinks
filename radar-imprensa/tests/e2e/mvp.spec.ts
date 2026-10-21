import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

// Roteiro do "resultado esperado" do MVP, ponta a ponta na interface real.
const env = Object.fromEntries(
  readFileSync(path.join(__dirname, ".env.e2e"), "utf8").trim().split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const email = "assessora.e2e@agencia.example";
const password = "senha-forte-123";

async function sql(query: string, params: unknown[] = []) {
  const c = new pg.Client({ connectionString: env.E2E_DATABASE_URL });
  await c.connect();
  try {
    return (await c.query(query, params)).rows;
  } finally {
    await c.end();
  }
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
}

test.describe.serial("MVP do assessor", () => {
  test("1-2. cria conta e entra", async ({ page }) => {
    // Estado limpo a cada execução (perfil, mailings e favoritos caem em cascata).
    await sql("delete from auth.users where email = $1", [email]);
    await page.goto("/cadastro");
    await page.getByLabel("Nome completo").fill("Assessora Exemplo");
    await page.getByLabel(/E-mail/).fill(email);
    await page.getByLabel("Agência ou organização (opcional)").fill("Agência Exemplo");
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByLabel("Confirme a senha").fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Criar conta" }).click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: "Olá, Assessora" })).toBeVisible();
    // Sessão persiste em nova navegação; logout e login de novo
    await page.getByRole("button", { name: "Sair" }).click();
    await page.waitForURL("**/login");
    await login(page);
  });

  test("3-4. busca por editoria, estado e tipo de veículo", async ({ page }) => {
    await login(page);
    await page.goto("/jornalistas");
    await page.getByLabel("Editoria", { exact: true }).selectOption({ label: "Política" });
    await page.waitForURL(/editoria=/);
    await page.getByLabel("Estado", { exact: true }).selectOption("PI");
    await page.waitForURL(/uf=PI/);
    await page.getByRole("checkbox", { name: "Portal" }).check();
    await page.waitForURL(/tipo=portal/);
    await expect(page.getByText("2 jornalistas encontrados")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ana Exemplo Ribeiro" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Paulo Teste Viana" })).toBeVisible();
    await expect(page.getByText("Diego Teste Andrade")).toHaveCount(0);
    // Filtros persistem na URL (recarregar mantém o resultado)
    await page.reload();
    await expect(page.getByText("2 jornalistas encontrados")).toBeVisible();
    // Combinação sem resultado mostra estado vazio explicativo
    await page.goto("/jornalistas?q=inexistente-xyz");
    await expect(page.getByText("Nenhum jornalista corresponde a esta combinação")).toBeVisible();
  });

  test("5-7, 10. perfil verificável, contatos permitidos, favorito e data de verificação", async ({ page }) => {
    await login(page);
    await page.goto("/jornalistas?q=Diego");
    await page.getByRole("link", { name: "Diego Teste Andrade" }).click();
    await expect(page.getByRole("heading", { name: "Diego Teste Andrade" })).toBeVisible();
    await expect(page.getByText("Histórico profissional")).toBeVisible();
    await expect(page.getByText("Repórter de Política").first()).toBeVisible(); // vínculo anterior no histórico
    await expect(page.getByText("Última confirmação").first()).toBeVisible();
    await page.getByRole("button", { name: "Ver contatos profissionais" }).click();
    await expect(page.getByRole("link", { name: "diego.andrade@diario-exemplo-carioca.example" })).toBeVisible();
    await page.getByRole("button", { name: "Salvar nos favoritos" }).click();
    await page.goto("/favoritos");
    await expect(page.getByRole("link", { name: "Diego Teste Andrade" })).toBeVisible();
  });

  test("8-9. cria mailing a partir da busca e exporta CSV com contatos permitidos", async ({ page }) => {
    await login(page);
    await page.goto("/jornalistas?uf=PI");
    await page.getByLabel("Selecionar todos desta página").check();
    await page.getByRole("button", { name: "Adicionar a mailing" }).click();
    await page.getByLabel("Nome da nova lista").fill("Imprensa — Piauí");
    await page.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(page.getByText(/adicionado\(s\) à lista/)).toBeVisible();
    await page.goto("/mailings");
    await page.getByRole("link", { name: /Imprensa — Piauí/ }).click();
    await expect(page.getByText("Ana Exemplo Ribeiro")).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Exportar CSV" }).click();
    const file = await (await download).path();
    const csv = readFileSync(file!, "utf8");
    expect(csv).toContain("ana.ribeiro@portal-exemplo-pi.example");
    expect(csv).not.toContain("politica@gazeta-ficticia.example"); // contato restrito
  });

  test("assessor não acessa a área administrativa", async ({ page }) => {
    await login(page);
    await page.goto("/admin");
    await page.waitForURL(/acesso=negado/);
  });
});

test.describe.serial("MVP do administrador", () => {
  test("cadastra, importa, verifica e revisa", async ({ page }) => {
    await sql("update public.profiles set role = 'super_admin' where email = $1", [email]);
    await login(page);
    await page.goto("/admin");
    await expect(page.getByText("Jornalistas cadastrados")).toBeVisible();

    // Importação CSV com prévia
    await page.goto("/admin/importacoes");
    await expect(page.getByLabel(/Arquivo CSV/)).toBeEnabled();
    await page.getByLabel(/Arquivo CSV/).setInputFiles(path.join(__dirname, "../../public/exemplos/importacao-exemplo.csv"));
    await expect(page.getByText(/7 linha\(s\)/)).toBeVisible();
    await page.getByRole("button", { name: "Gerar prévia" }).click();
    await page.waitForURL(/\/admin\/importacoes\/[0-9a-f-]{36}/);
    await expect(page.getByText("Editoria não reconhecida")).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /Aprovar e gravar/ }).click();
    await expect(page.getByText(/Relatório: \d+ criado/)).toBeVisible();
    const [imported] = await sql("select verification_status from public.journalists where full_name = 'Tatiana Exemplo Moura'");
    expect(imported.verification_status).toBe("nao_verificado");

    // Verificação periódica com provedor demonstrativo
    await page.goto("/admin/verificacoes");
    await page.getByRole("button", { name: "Agendar vencidas" }).click();
    await expect(page.getByText(/verificação\(ões\) agendada\(s\)/)).toBeVisible();
    await sql("update public.verification_jobs set scheduled_at = now() - interval '1 minute' where status = 'agendada'");
    await page.getByRole("button", { name: "Executar lote agora" }).click();
    await expect(page.getByText(/processada\(s\)/)).toBeVisible();

    // Revisão de propostas
    await page.goto("/admin/revisoes");
    await expect(page.getByRole("heading", { name: /Propostas de alteração/ })).toBeVisible();
    const approve = page.getByRole("button", { name: "Aprovar" }).first();
    if (await approve.isVisible()) {
      await approve.click();
      // O card sai da lista após a revalidação; o efeito é conferido no banco.
      await expect
        .poll(async () => (await sql("select count(*)::int as n from public.change_proposals where status = 'aprovada'"))[0].n)
        .toBeGreaterThan(0);
    }

    // Duplicidades: detecção cria sugestões, nunca unifica sozinha
    await page.goto("/admin/duplicidades");
    await page.getByRole("button", { name: "Detectar possíveis duplicidades" }).click();
    await expect(page.getByText(/nova\(s\) sugestão\(ões\)/)).toBeVisible();
    const merged = await sql("select count(*)::int as n from public.journalist_merges");
    expect(merged[0].n).toBe(0);

    // Configurações não expõem segredos
    await page.goto("/admin/configuracoes");
    await expect(page.getByRole("heading", { name: "Integrações" })).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain(env.SUPABASE_SERVICE_ROLE_KEY);
    expect(html).not.toContain(env.CRON_SECRET);
  });

  test("endpoint de cron exige segredo e processa com service_role", async ({ request }) => {
    expect((await request.post("/api/cron/verificacoes")).status()).toBe(401);
    const ok = await request.post("/api/cron/verificacoes", { headers: { Authorization: `Bearer ${env.CRON_SECRET}` }, data: { schedule: true } });
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toMatchObject({ provider: "demo" });
  });
});
