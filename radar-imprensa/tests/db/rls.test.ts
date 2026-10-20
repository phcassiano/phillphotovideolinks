import { describe, expect, it } from "vitest";
import { J, expectDenied, setupTestDb } from "./helpers";

const db = setupTestDb();

describe("RLS e autorização no banco", () => {
  it("todas as tabelas públicas têm RLS habilitado", async () => {
    const rows = await db.sys("select tablename from pg_tables where schemaname = 'public' and not rowsecurity");
    expect(rows).toEqual([]);
  });

  it("anônimo não acessa nenhuma tabela nem RPC", async () => {
    await expectDenied(db.as(null, "select * from public.journalists"));
    await expectDenied(db.as(null, "select * from public.locations"));
    await expectDenied(db.as(null, "select public.search_journalists()"));
  });

  it("cadastro cria perfil de assessor ou jornalista, nunca administrador", async () => {
    const a = await db.createUser({ accountType: "admin" });
    const [p] = await db.sys<{ role: string }>("select role from public.profiles where id = $1", [a]);
    expect(p!.role).toBe("assessor");
    const j = await db.createUser({ role: "jornalista" });
    const [pj] = await db.sys<{ role: string }>("select role from public.profiles where id = $1", [j]);
    expect(pj!.role).toBe("jornalista");
  });

  it("usuário não consegue elevar o próprio papel", async () => {
    const u = await db.createUser();
    await expectDenied(db.as(u, "update public.profiles set role = 'super_admin' where id = $1", [u]));
    await db.as(u, "update public.profiles set full_name = 'Novo Nome' where id = $1", [u]);
    const [p] = await db.sys<{ role: string; full_name: string }>("select role, full_name from public.profiles where id = $1", [u]);
    expect(p).toEqual({ role: "assessor", full_name: "Novo Nome" });
  });

  it("set_user_role é exclusivo do administrador principal e é auditado", async () => {
    const admin = await db.createUser({ role: "admin" });
    const sup = await db.createUser({ role: "super_admin" });
    const u = await db.createUser();
    await expectDenied(db.as(admin, "select public.set_user_role($1, 'admin', null)", [u]));
    await db.as(sup, "select public.set_user_role($1, 'admin', null)", [u]);
    const logs = await db.sys("select * from public.audit_logs where entity_type = 'profiles' and entity_id = $1", [u]);
    expect(logs).toHaveLength(1);
    await expectDenied(db.as(sup, "select public.set_user_role($1, 'assessor', null)", [sup]), /último administrador/);
  });

  it("assessor não lê tabelas de jornalistas, vínculos, contatos e evidências diretamente", async () => {
    const u = await db.createUser();
    for (const table of ["journalists", "journalist_contacts", "journalist_employments", "source_evidence", "journalist_change_history"]) {
      const rows = await db.as(u, `select * from public.${table}`);
      expect(rows, table).toEqual([]);
    }
    // Dados de referência são legíveis
    expect((await db.as(u, "select * from public.editorial_categories")).length).toBeGreaterThan(10);
  });

  it("assessor não altera dados de jornalistas", async () => {
    const u = await db.createUser();
    const rows = await db.as(u, "update public.journalists set full_name = 'X' where id = $1 returning id", [J(1)]);
    expect(rows).toEqual([]);
    await expectDenied(db.as(u, "insert into public.journalists (full_name) values ('Invasor Exemplo')"));
  });

  it("administrador lê e edita registros", async () => {
    const admin = await db.createUser({ role: "admin" });
    expect((await db.as(admin, "select id from public.journalist_contacts")).length).toBeGreaterThan(5);
    const rows = await db.as(admin, "update public.journalists set biography = 'Bio' where id = $1 returning id", [J(3)]);
    expect(rows).toHaveLength(1);
  });

  it("titular edita campos descritivos do próprio perfil, mas não a verificação", async () => {
    const j = await db.createUser({ role: "jornalista" });
    await db.sys("update public.journalists set claimed_by = $1 where id = $2", [j, J(3)]);
    await db.as(j, "update public.journalists set biography = 'Minha bio' where id = $1", [J(3)]);
    await expectDenied(db.as(j, "update public.journalists set verification_status = 'confirmado' where id = $1", [J(3)]));
    // Não edita perfis de terceiros
    expect(await db.as(j, "update public.journalists set biography = 'x' where id = $1 returning id", [J(1)])).toEqual([]);
    // Contato informado pelo titular entra como "provável"
    const [c] = await db.as<{ verification_status: string }>(
      j,
      "insert into public.journalist_contacts (journalist_id, contact_type, contact_value, visibility, legal_basis, consent_recorded_at) values ($1, 'email_profissional', 'carla@tv-modelo.example', 'assinantes', 'consentimento', now()) returning verification_status",
      [J(3)],
    );
    expect(c!.verification_status).toBe("provavel");
  });

  it("WhatsApp exige consentimento registrado", async () => {
    await expectDenied(
      db.sys("insert into public.journalist_contacts (journalist_id, contact_type, contact_value) values ($1, 'whatsapp_profissional', '+55 (00) 90000-1111')", [J(3)]),
      /check constraint/,
    );
  });

  it("mailings privados são isolados entre usuários; os de organização são compartilhados", async () => {
    const [org] = await db.sys<{ id: string }>("insert into public.organizations (name) values ('Agência Exemplo') returning id");
    const owner = await db.createUser({ org: org!.id });
    const colleague = await db.createUser({ org: org!.id });
    const stranger = await db.createUser();
    const [priv] = await db.as<{ id: string }>(owner, "insert into public.mailing_lists (owner_id, name) values ($1, 'Privada') returning id", [owner]);
    const [shared] = await db.as<{ id: string }>(owner, "insert into public.mailing_lists (owner_id, organization_id, name, visibility) values ($1, $2, 'Compartilhada', 'organizacao') returning id", [owner, org!.id]);
    await db.as(owner, "insert into public.mailing_list_members (mailing_list_id, journalist_id, notes) values ($1, $2, 'nota privada')", [shared!.id, J(1)]);

    expect(await db.as(stranger, "select id from public.mailing_lists")).toEqual([]);
    expect(await db.as(stranger, "select * from public.mailing_list_members")).toEqual([]);
    expect((await db.as<{ id: string }>(colleague, "select id from public.mailing_lists")).map((r) => r.id)).toEqual([shared!.id]);
    expect(await db.as(colleague, "select notes from public.mailing_list_members")).toEqual([{ notes: "nota privada" }]);
    // Colega lê, mas não altera
    await expectDenied(db.as(colleague, "insert into public.mailing_list_members (mailing_list_id, journalist_id) values ($1, $2)", [shared!.id, J(2)]));
    expect(await db.as(colleague, "delete from public.mailing_lists where id = $1 returning id", [shared!.id])).toEqual([]);
    expect(await db.as(stranger, "select id from public.mailing_lists where id = $1", [priv!.id])).toEqual([]);
    // Não é possível criar lista em nome de outra organização
    await expectDenied(db.as(stranger, "insert into public.mailing_lists (owner_id, organization_id, name, visibility) values ($1, $2, 'X', 'organizacao')", [stranger, org!.id]));
  });

  it("não é possível adicionar perfil oculto a mailings ou favoritos", async () => {
    const u = await db.createUser();
    await expectDenied(db.as(u, "insert into public.favorites (user_id, journalist_id) values ($1, $2)", [u, J(19)]));
  });

  it("favoritos e interações são privados", async () => {
    const a = await db.createUser();
    const b = await db.createUser();
    await db.as(a, "insert into public.favorites (user_id, journalist_id) values ($1, $2)", [a, J(1)]);
    await db.as(a, "insert into public.journalist_interactions (owner_id, journalist_id, interaction_type, subject) values ($1, $2, 'email', 'Release')", [a, J(1)]);
    expect(await db.as(b, "select * from public.favorites")).toEqual([]);
    expect(await db.as(b, "select * from public.journalist_interactions")).toEqual([]);
    await expectDenied(db.as(b, "insert into public.favorites (user_id, journalist_id) values ($1, $2)", [a, J(2)]));
  });

  it("logs de auditoria só são visíveis ao administrador principal", async () => {
    const admin = await db.createUser({ role: "admin" });
    const sup = await db.createUser({ role: "super_admin" });
    expect(await db.as(admin, "select * from public.audit_logs limit 1")).toEqual([]);
    expect((await db.as(sup, "select * from public.audit_logs limit 1")).length).toBe(1);
  });

  it("parâmetros globais: leitura autenticada, escrita só do administrador principal", async () => {
    const admin = await db.createUser({ role: "admin" });
    expect((await db.as(admin, "select * from public.app_settings")).length).toBeGreaterThan(5);
    expect(await db.as(admin, "update public.app_settings set value = '1' where key = 'export.max_rows' returning key")).toEqual([]);
  });

  it("tabela de limites de uso é inacessível pela API", async () => {
    const u = await db.createUser();
    expect(await db.as(u, "select * from public.rate_limit_events")).toEqual([]);
    await expectDenied(db.as(u, "insert into public.rate_limit_events (user_id, action) values ($1, 'x')", [u]));
  });

  it("RPCs administrativas recusam usuários comuns", async () => {
    const u = await db.createUser();
    await expectDenied(db.as(u, "select public.admin_dashboard_stats()"));
    await expectDenied(db.as(u, "select * from public.claim_verification_jobs(5)"));
    await expectDenied(db.as(u, "select public.schedule_due_verifications(5)"));
    await expectDenied(db.as(u, "select * from public.duplicate_candidate_pairs()"));
    await expectDenied(db.as(u, "select public.merge_journalists($1, $2)", [J(1), J(14)]));
  });
});
