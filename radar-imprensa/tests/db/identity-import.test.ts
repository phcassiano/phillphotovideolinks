import { describe, expect, it } from "vitest";
import { autoMapColumns, buildPreview, parseCsv, type ExistingCandidate } from "@/lib/csv/import";
import { assessDuplicatePair } from "@/lib/identity/duplicates";
import { J, setupTestDb } from "./helpers";

const db = setupTestDb();

interface Pair {
  journalist_a_id: string;
  journalist_b_id: string;
  name_a: string;
  name_b: string;
  professional_name_a: string | null;
  professional_name_b: string | null;
  shared_outlets: number;
  shared_identifiers: number;
  conflicting_identifiers: number;
  shared_bylines: number;
}

const assess = (p: Pair) =>
  assessDuplicatePair({
    nameA: p.name_a, nameB: p.name_b, professionalNameA: p.professional_name_a, professionalNameB: p.professional_name_b,
    sharedOutlets: p.shared_outlets, sharedIdentifiers: p.shared_identifiers, conflictingIdentifiers: p.conflicting_identifiers, sharedBylines: p.shared_bylines,
  });
const key = (a: string, b: string) => [a, b].sort().join("|");

describe("resolução de identidade", () => {
  it("distingue duplicidade provável de homônimo", async () => {
    const admin = await db.createUser({ role: "admin" });
    const pairs = await db.as<Pair>(admin, "select * from public.duplicate_candidate_pairs(0.3, 200)");
    const byKey = new Map(pairs.map((p) => [key(p.journalist_a_id, p.journalist_b_id), p]));

    const dup = byKey.get(key(J(1), J(14)))!; // Ana Exemplo Ribeiro x Ana E. Ribeiro: mesmo veículo e assinatura
    expect(dup).toMatchObject({ shared_outlets: 1, shared_bylines: 1 });
    expect(assess(dup).shouldSuggest).toBe(true);

    const homonym = byKey.get(key(J(1), J(13)))!; // mesmo nome, registros profissionais diferentes
    expect(homonym.conflicting_identifiers).toBe(1);
    expect(assess(homonym).shouldSuggest).toBe(false);
  });

  it("unificação move dados, esconde o registro unificado e pode ser desfeita", async () => {
    const admin = await db.createUser({ role: "admin" });
    const u = await db.createUser();
    await db.as(u, "insert into public.favorites (user_id, journalist_id) values ($1, $2)", [u, J(14)]);
    const [m] = await db.as<{ id: string }>(admin, "select public.merge_journalists($1, $2, null) as id", [J(1), J(14)]);

    const empsAfter = await db.sys("select id from public.journalist_employments where journalist_id = $1", [J(1)]);
    expect(empsAfter).toHaveLength(2); // vínculo antigo de J14 passou para J1
    const [merged] = await db.sys<{ merged_into_id: string }>("select merged_into_id from public.journalists where id = $1", [J(14)]);
    expect(merged!.merged_into_id).toBe(J(1));
    expect(await db.sys("select 1 from public.favorites where user_id = $1 and journalist_id = $2", [u, J(1)])).toHaveLength(1);
    const [search] = await db.as<{ r: { items: { id: string }[] } }>(u, "select public.search_journalists(p_query => 'ana', p_current_only => false) as r");
    expect(search!.r.items.map((i) => i.id)).not.toContain(J(14));

    await db.as(admin, "select public.unmerge_journalists($1)", [m!.id]);
    expect(await db.sys("select id from public.journalist_employments where journalist_id = $1", [J(1)])).toHaveLength(1);
    expect(await db.sys("select id from public.journalist_employments where journalist_id = $1", [J(14)])).toHaveLength(1);
    expect(await db.sys("select 1 from public.favorites where user_id = $1 and journalist_id = $2", [u, J(1)])).toHaveLength(0);
    const [restored] = await db.sys<{ merged_into_id: string | null }>("select merged_into_id from public.journalists where id = $1", [J(14)]);
    expect(restored!.merged_into_id).toBeNull();
    const history = await db.sys("select 1 from public.journalist_change_history where change_source = 'unificacao'");
    expect(history.length).toBeGreaterThan(0);
  });
});

describe("importação CSV com gravação aprovada", () => {
  const csv = [
    "Nome;Veículo;Tipo de veículo;Editoria;Estado;Cidade;Cargo;E-mail profissional;Fonte;Data da verificação",
    "Nova Pessoa Exemplo;Veículo Inédito Exemplo;Portal;Política;MA;Imperatriz;Repórter;nova@veiculo-inedito.example;https://veiculo-inedito.example/equipe;01/10/2026",
    "Ana Exemplo Ribeiro;Portal Exemplo Piauí;Portal;Política;PI;Teresina;Editora;ana.ribeiro@portal-exemplo-pi.example;https://portal-exemplo-pi.example/equipe;10/10/2026",
    "Com Erro Exemplo;Portal;Portal;Inexistente;PI;Teresina;;;;",
  ].join("\n");

  it("prévia → aprovação → registros não verificados, contatos restritos e evidência pendente", async () => {
    const admin = await db.createUser({ role: "admin" });
    const parsed = parseCsv(csv);
    const mapping = autoMapColumns(parsed.headers);
    const categories = await db.as<{ id: string; name: string }>(admin, "select id, name from public.editorial_categories");
    const candidates = await db.as<ExistingCandidate>(admin, "select * from public.import_duplicate_candidates($1, $2)", [
      parsed.rows.map((r) => r.Nome), parsed.rows.map((r) => r["E-mail profissional"]).filter(Boolean),
    ]);
    const preview = buildPreview(parsed, mapping, categories, candidates, new Date("2026-10-20T12:00:00Z"));
    expect(preview.rows.map((r) => r.action)).toEqual(["criar", "vincular", "ignorar"]);
    expect(preview.rows[1]!.duplicateOf).toBe(J(1));

    const [batch] = await db.as<{ id: string }>(admin, "insert into public.import_batches (created_by, file_name, total_rows) values ($1, 'teste.csv', 3) returning id", [admin]);
    for (const r of preview.rows) {
      await db.as(admin, "insert into public.import_rows (batch_id, row_number, raw, normalized, errors, warnings, duplicate_of, action) values ($1, $2, $3, $4, $5, $6, $7, $8)", [
        batch!.id, r.rowNumber, JSON.stringify(r.raw), r.normalized ? JSON.stringify(r.normalized) : null, JSON.stringify(r.errors), JSON.stringify(r.warnings), r.duplicateOf, r.action,
      ]);
    }
    const [res] = await db.as<{ r: Record<string, number> }>(admin, "select public.commit_import_batch($1) as r", [batch!.id]);
    expect(res!.r).toEqual({ created: 1, linked: 1, skipped: 1, failed: 0 });

    const [created] = await db.sys<{ id: string; verification_status: string }>("select id, verification_status from public.journalists where full_name = 'Nova Pessoa Exemplo'");
    expect(created!.verification_status).toBe("nao_verificado");
    const [contact] = await db.sys<{ visibility: string; verification_status: string; source_id: string }>("select visibility, verification_status, source_id from public.journalist_contacts where journalist_id = $1", [created!.id]);
    expect(contact).toMatchObject({ visibility: "restrito", verification_status: "nao_verificado" });
    const [ev] = await db.sys<{ review_status: string; evidence_type: string; observed: string }>("select review_status, evidence_type, observed_at::date::text as observed from public.source_evidence where id = $1", [contact!.source_id]);
    expect(ev).toEqual({ review_status: "pendente", evidence_type: "importacao", observed: "2026-10-01" });
    // Cidade inexistente na base é criada vinculada à UF; veículo novo é criado
    expect(await db.sys("select 1 from public.locations where state_code = 'MA' and city_name = 'Imperatriz'")).toHaveLength(1);
    expect(await db.sys("select 1 from public.media_outlets where name = 'Veículo Inédito Exemplo'")).toHaveLength(1);
    // Linha vinculada: Ana ganha novo vínculo (cargo diferente), sem perder o anterior
    const anaEmps = await db.sys("select job_title from public.journalist_employments where journalist_id = $1 and is_current order by job_title", [J(1)]);
    expect(anaEmps).toEqual([{ job_title: "Editora" }, { job_title: "Repórter" }]);
    // Status da Ana não é rebaixado nem promovido pela importação
    const [ana] = await db.sys<{ verification_status: string }>("select verification_status from public.journalists where id = $1", [J(1)]);
    expect(ana!.verification_status).toBe("confirmado");
    // Lote não pode ser gravado duas vezes
    await expect(db.as(admin, "select public.commit_import_batch($1)", [batch!.id])).rejects.toThrow(/já processada/);
  });
});
