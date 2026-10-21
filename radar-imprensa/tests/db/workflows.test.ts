import { describe, expect, it } from "vitest";
import { J, O, expectDenied, setupTestDb } from "./helpers";

const db = setupTestDb();

async function evidence(journalistId: string, url: string) {
  const [e] = await db.sys<{ id: string }>(
    "insert into public.source_evidence (journalist_id, related_entity_type, source_url, source_title, evidence_type, confidence_score) values ($1, 'journalist', $2, 'Fonte', 'perfil_institucional', 0.9) returning id",
    [journalistId, url],
  );
  return e!.id;
}

async function proposal(journalistId: string, changes: unknown[], evidenceIds: string[], source = "verificacao_automatica", extra: Record<string, unknown> = {}) {
  const [p] = await db.sys<{ id: string }>(
    "insert into public.change_proposals (journalist_id, proposed_changes, evidence_ids, source, prior_verification_status, is_demo) values ($1, $2, $3, $4, $5, $6) returning id",
    [journalistId, JSON.stringify(changes), evidenceIds, source, extra.prior ?? null, extra.demo ?? false],
  );
  return p!.id;
}

describe("propostas de alteração", () => {
  it("mudança de emprego aprovada preserva o vínculo anterior e registra histórico", async () => {
    const admin = await db.createUser({ role: "admin" });
    const [current] = await db.sys<{ id: string }>("select id from public.journalist_employments where journalist_id = $1 and is_current", [J(2)]);
    const ev = await evidence(J(2), "https://diario-exemplo-carioca.example/equipe");
    const p = await proposal(J(2), [
      { op: "end_employment", employment_id: current!.id, end_date: "2026-09-30" },
      { op: "add_employment", media_outlet_id: O(5), job_title: "Editor", category_ids: [await db.category("politica")] },
    ], [ev]);

    await db.as(admin, "select public.review_change_proposal($1, true, 'ok')", [p]);

    const emps = await db.sys<{ media_outlet_id: string; is_current: boolean; end_date: string | null; verification_status: string; source_id: string | null }>(
      "select media_outlet_id, is_current, end_date::text, verification_status, source_id from public.journalist_employments where journalist_id = $1 order by is_current",
      [J(2)],
    );
    expect(emps).toHaveLength(2);
    expect(emps[0]).toMatchObject({ media_outlet_id: O(2), is_current: false, end_date: "2026-09-30" });
    expect(emps[1]).toMatchObject({ media_outlet_id: O(5), is_current: true, verification_status: "confirmado", source_id: ev });

    const history = await db.sys<{ field_name: string; change_source: string; approved_by: string }>(
      "select field_name, change_source, approved_by from public.journalist_change_history where journalist_id = $1 and change_source = 'verificacao'",
      [J(2)],
    );
    expect(history.map((h) => h.field_name)).toEqual(expect.arrayContaining(["is_current", "end_date", "*criado*"]));
    expect(history.every((h) => h.approved_by === admin)).toBe(true);
    const [ev2] = await db.sys<{ review_status: string }>("select review_status from public.source_evidence where id = $1", [ev]);
    expect(ev2!.review_status).toBe("aceita");
  });

  it("mudanças sensíveis sem evidência são recusadas", async () => {
    const admin = await db.createUser({ role: "admin" });
    const p = await proposal(J(3), [{ op: "add_contact", contact_type: "email_profissional", contact_value: "x@tv-modelo.example" }], []);
    await expectDenied(db.as(admin, "select public.review_change_proposal($1, true)", [p]), /exige evidência/);
  });

  it("rejeição restaura o status anterior ao 'em revisão'", async () => {
    const admin = await db.createUser({ role: "admin" });
    await db.sys("update public.journalists set verification_status = 'em_revisao' where id = $1", [J(10)]);
    const ev = await evidence(J(10), "https://x.example/1");
    const p = await proposal(J(10), [{ op: "add_employment", media_outlet_id: O(3) }], [ev], "verificacao_automatica", { prior: "nao_verificado" });
    await db.as(admin, "select public.review_change_proposal($1, false, 'fonte fraca')", [p]);
    const [j] = await db.sys<{ verification_status: string }>("select verification_status from public.journalists where id = $1", [J(10)]);
    expect(j!.verification_status).toBe("nao_verificado");
    const [e] = await db.sys<{ review_status: string }>("select review_status from public.source_evidence where id = $1", [ev]);
    expect(e!.review_status).toBe("rejeitada");
  });

  it("propostas demonstrativas não são aplicadas quando a configuração proíbe", async () => {
    const admin = await db.createUser({ role: "admin" });
    await db.sys("update public.app_settings set value = '0' where key = 'verification.allow_demo_apply'");
    const p = await proposal(J(3), [{ op: "confirm_current" }], [], "verificacao_automatica", { demo: true });
    await expectDenied(db.as(admin, "select public.review_change_proposal($1, true)", [p]), /demonstrativas/);
  });

  it("somente administradores revisam propostas", async () => {
    const u = await db.createUser();
    const p = await proposal(J(3), [{ op: "confirm_current" }], []);
    await expectDenied(db.as(u, "select public.review_change_proposal($1, true)", [p]));
  });

  it("fluxo de correção: assessor sugere, administrador vê e decide", async () => {
    const u = await db.createUser();
    const admin = await db.createUser({ role: "admin" });
    const [row] = await db.as<{ id: string }>(u, "select public.submit_correction($1, 'Mudou de veículo em setembro', 'https://fonte.example/x') as id", [J(1)]);
    const [p] = await db.as<{ status: string; source: string; evidence_ids: string[] }>(admin, "select status, source, evidence_ids from public.change_proposals where id = $1", [row!.id]);
    expect(p).toMatchObject({ status: "pendente", source: "sugestao_usuario" });
    expect(p!.evidence_ids).toHaveLength(1);
    // O autor vê a própria sugestão; outro usuário não
    expect(await db.as(u, "select id from public.change_proposals")).toHaveLength(1);
    expect(await db.as(await db.createUser(), "select id from public.change_proposals")).toEqual([]);
    // Assessor não consegue inserir proposta já aprovada
    await expectDenied(db.as(u, "insert into public.change_proposals (journalist_id, proposed_changes, source, proposed_by, status) values ($1, '[{\"op\":\"confirm_current\"}]', 'sugestao_usuario', $2, 'aprovada')", [J(1), u]));
    await db.as(admin, "select public.review_change_proposal($1, false, 'sem evidência suficiente')", [row!.id]);
  });
});

describe("titulares", () => {
  it("reivindicação: só contas de jornalista; aprovação vincula o perfil", async () => {
    const assessor = await db.createUser();
    const jornalista = await db.createUser({ role: "jornalista", email: "carla@tv-modelo.example" });
    const admin = await db.createUser({ role: "admin" });
    await expectDenied(db.as(assessor, "select public.submit_profile_claim($1, 'email_corporativo', null)", [J(3)]), /jornalista/);
    const [c] = await db.as<{ id: string }>(jornalista, "select public.submit_profile_claim($1, 'email_corporativo', 'link do expediente') as id", [J(3)]);
    const [claim] = await db.sys<{ email_domain_match: boolean }>("select email_domain_match from public.profile_claims where id = $1", [c!.id]);
    expect(claim!.email_domain_match).toBe(true);
    await db.as(admin, "select public.review_profile_claim($1, true, 'conferido')", [c!.id]);
    const [j] = await db.sys<{ claimed_by: string }>("select claimed_by from public.journalists where id = $1", [J(3)]);
    expect(j!.claimed_by).toBe(jornalista);
    // Perfil já reivindicado não aceita nova reivindicação
    const other = await db.createUser({ role: "jornalista" });
    await expectDenied(db.as(other, "select public.submit_profile_claim($1, 'outro', null)", [J(3)]), /já foi reivindicado/);
  });

  it("titular confirma os próprios dados: status confirmado com evidência de declaração", async () => {
    const j = await db.createUser({ role: "jornalista" });
    await db.sys("update public.journalists set claimed_by = $1 where id = $2", [j, J(10)]);
    await db.as(j, "select public.confirm_own_profile()");
    const [row] = await db.sys<{ verification_status: string; last_verified_at: Date | null }>("select verification_status, last_verified_at from public.journalists where id = $1", [J(10)]);
    expect(row!.verification_status).toBe("confirmado");
    expect(row!.last_verified_at).not.toBeNull();
    const evs = await db.sys("select * from public.source_evidence where journalist_id = $1 and evidence_type = 'declaracao_titular'", [J(10)]);
    expect(evs).toHaveLength(1);
  });

  it("oposição atendida oculta o perfil das buscas e os contatos", async () => {
    const owner = await db.createUser({ role: "jornalista" });
    const admin = await db.createUser({ role: "admin" });
    const assessor = await db.createUser();
    await db.sys("update public.journalists set claimed_by = $1 where id = $2", [owner, J(5)]);
    const [r] = await db.as<{ id: string }>(owner, "select public.submit_privacy_request('oposicao', 'Não desejo constar na plataforma.', $1, null) as id", [J(5)]);
    await db.as(admin, "select public.resolve_privacy_request($1, 'atendida', 'ok')", [r!.id]);
    const [s] = await db.as<{ r: { total: number } }>(assessor, "select public.search_journalists(p_query => 'Elisa') as r");
    expect(s!.r.total).toBe(0);
    const contacts = await db.sys<{ visibility: string }>("select visibility from public.journalist_contacts where journalist_id = $1", [J(5)]);
    expect(contacts.every((c) => c.visibility === "oculto")).toBe(true);
  });

  it("exclusão atendida remove a ficha e mantém auditoria sem dados pessoais", async () => {
    const owner = await db.createUser({ role: "jornalista" });
    const admin = await db.createUser({ role: "admin" });
    await db.sys("update public.journalists set claimed_by = $1 where id = $2", [owner, J(20)]);
    const [r] = await db.as<{ id: string }>(owner, "select public.submit_privacy_request('exclusao', 'Solicito a exclusão dos meus dados.', $1, null) as id", [J(20)]);
    await db.as(admin, "select public.resolve_privacy_request($1, 'atendida', null)", [r!.id]);
    expect(await db.sys("select id from public.journalists where id = $1", [J(20)])).toEqual([]);
    expect(await db.sys("select id from public.journalist_contacts where journalist_id = $1", [J(20)])).toEqual([]);
    const [req] = await db.sys<{ status: string; journalist_id: string | null }>("select status, journalist_id from public.privacy_requests where id = $1", [r!.id]);
    expect(req).toEqual({ status: "atendida", journalist_id: null });
    const logs = await db.sys<{ metadata: Record<string, unknown> }>("select metadata from public.audit_logs where action = 'privacy.resolve' and entity_id = $1", [r!.id]);
    expect(JSON.stringify(logs[0]!.metadata)).not.toContain("Sofia");
  });
});
