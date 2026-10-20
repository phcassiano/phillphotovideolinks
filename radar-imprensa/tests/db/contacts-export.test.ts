import { describe, expect, it } from "vitest";
import { J, expectDenied, setupTestDb } from "./helpers";

const db = setupTestDb();

describe("contatos e exportação", () => {
  it("assessor vê apenas contatos com visibilidade liberada", async () => {
    const u = await db.createUser();
    const ana = await db.as<{ contact_value: string; source_url: string | null }>(u, "select * from public.get_journalist_contacts($1)", [J(1)]);
    expect(ana.map((c) => c.contact_value)).toEqual(["ana.ribeiro@portal-exemplo-pi.example", "+55 (00) 90000-0001"]);
    expect(ana[0]!.source_url).toBe("https://portal-exemplo-pi.example/equipe");
    expect(await db.as(u, "select * from public.get_journalist_contacts($1)", [J(2)])).toEqual([]); // restrito
    expect(await db.as(u, "select * from public.get_journalist_contacts($1)", [J(19)])).toEqual([]); // perfil oculto
  });

  it("administrador e titular veem também contatos restritos", async () => {
    const admin = await db.createUser({ role: "admin" });
    expect((await db.as(admin, "select * from public.get_journalist_contacts($1)", [J(2)])).length).toBe(1);
    const owner = await db.createUser({ role: "jornalista" });
    await db.sys("update public.journalists set claimed_by = $1 where id = $2", [owner, J(2)]);
    expect((await db.as(owner, "select * from public.get_journalist_contacts($1)", [J(2)])).length).toBe(1);
  });

  it("limite diário de perfis distintos com contatos consultados", async () => {
    await db.sys("update public.app_settings set value = '2' where key = 'rate_limit.contact_profiles_per_day'");
    const u = await db.createUser();
    await db.as(u, "select * from public.get_journalist_contacts($1)", [J(1)]);
    await db.as(u, "select * from public.get_journalist_contacts($1)", [J(1)]); // repetido não conta
    await db.as(u, "select * from public.get_journalist_contacts($1)", [J(4)]);
    await expectDenied(db.as(u, "select * from public.get_journalist_contacts($1)", [J(5)]), /Limite diário/);
  });

  async function mailingWith(owner: string, members: string[]) {
    const [m] = await db.as<{ id: string }>(owner, "insert into public.mailing_lists (owner_id, name) values ($1, 'Imprensa — Piauí') returning id", [owner]);
    for (const jid of members) {
      await db.as(owner, "insert into public.mailing_list_members (mailing_list_id, journalist_id, notes) values ($1, $2, $3)", [m!.id, jid, `nota ${jid.slice(-2)}`]);
    }
    return m!.id;
  }

  it("exportação inclui somente contatos permitidos e é auditada", async () => {
    const u = await db.createUser();
    const mailing = await mailingWith(u, [J(1), J(2), J(4)]);
    const rows = await db.as<{ full_name: string; email: string | null; phone: string | null; notes: string; outlet_names: string }>(u, "select * from public.export_mailing_contacts($1)", [mailing]);
    expect(rows.map((r) => r.full_name)).toEqual(["Ana Exemplo Ribeiro", "Bruno Fictício Lima", "Diego Teste Andrade"]);
    expect(rows[0]).toMatchObject({ email: "ana.ribeiro@portal-exemplo-pi.example", phone: "+55 (00) 90000-0001", notes: "nota 01" });
    expect(rows[1]!.email).toBeNull(); // contato restrito não é exportado
    expect(rows[2]!.outlet_names).toBe("Diário Exemplo Carioca"); // apenas vínculo atual
    const logs = await db.sys("select * from public.audit_logs where action = 'mailing.export' and entity_id = $1", [mailing]);
    expect(logs).toHaveLength(1);
  });

  it("exportação de mailing de outro usuário é negada", async () => {
    const owner = await db.createUser();
    const other = await db.createUser();
    const mailing = await mailingWith(owner, [J(1)]);
    await expectDenied(db.as(other, "select * from public.export_mailing_contacts($1)", [mailing]), /sem permissão/);
  });

  it("membros removidos do acesso público (ocultados) saem da exportação", async () => {
    const u = await db.createUser();
    const mailing = await mailingWith(u, [J(1), J(5)]);
    await db.sys("update public.journalists set is_hidden = true where id = $1", [J(5)]);
    const rows = await db.as(u, "select * from public.export_mailing_contacts($1)", [mailing]);
    expect(rows).toHaveLength(1);
  });

  it("limite de exportações por hora", async () => {
    await db.sys("update public.app_settings set value = '1' where key = 'rate_limit.exports_per_hour'");
    const u = await db.createUser();
    const mailing = await mailingWith(u, [J(1)]);
    await db.as(u, "select * from public.export_mailing_contacts($1)", [mailing]);
    await expectDenied(db.as(u, "select * from public.export_mailing_contacts($1)", [mailing]), /Limite de uso/);
  });

  it("cartões de jornalistas só para perfis ligados ao usuário (anti-enumeração)", async () => {
    const u = await db.createUser();
    await db.as(u, "insert into public.favorites (user_id, journalist_id) values ($1, $2)", [u, J(1)]);
    const [row] = await db.as<{ c: { id: string }[] }>(u, "select public.journalist_cards($1) as c", [[J(1), J(2), J(3)]]);
    expect(row!.c.map((c) => c.id)).toEqual([J(1)]);
  });
});
