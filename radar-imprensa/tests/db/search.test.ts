import { beforeEach, describe, expect, it } from "vitest";
import { J, O, expectDenied, setupTestDb } from "./helpers";

const db = setupTestDb();

interface Result {
  total: number;
  items: { id: string; full_name: string; matched_current: boolean; has_contact: boolean; verification_status: string; current_employments: { outlet: { name: string } }[] }[];
}

let user: string;
beforeEach(async () => {
  user = await db.createUser();
});

async function search(args: Record<string, unknown>): Promise<Result> {
  const keys = Object.keys(args);
  const sql = `select public.search_journalists(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`;
  const [row] = await db.as<{ r: Result }>(user, sql, Object.values(args));
  return row!.r;
}
const ids = (r: Result) => r.items.map((i) => i.id).sort();

describe("busca avançada", () => {
  it("Política + Piauí + Portal retorna apenas vínculos atuais que atendem aos três critérios", async () => {
    const r = await search({ p_category_ids: [await db.category("politica")], p_state_code: "PI", p_outlet_types: "{portal}" });
    // Ana (Portal/Teresina) e Paulo (Portal, atuação no estado inteiro).
    // Excluídos: Bruno (jornal), Diego (vínculo de política no PI é ANTIGO), Rafael (oculto), Ana E. (vínculo antigo).
    expect(ids(r)).toEqual([J(1), J(18)].sort());
  });

  it("Cultura + Rio de Janeiro não confunde vínculos antigos com atuais", async () => {
    const r = await search({ p_category_ids: [await db.category("cultura")], p_state_code: "RJ" });
    expect(ids(r)).toEqual([J(4), J(5), J(6)].sort());
    expect(r.items.every((i) => i.matched_current)).toBe(true);
  });

  it("editoria principal inclui subeditorias; subeditoria filtra mais", async () => {
    const all = await search({ p_category_ids: [await db.category("politica")] });
    const congress = await search({ p_category_ids: [await db.category("congresso-nacional")] });
    expect(ids(all)).toEqual(expect.arrayContaining([J(8), J(9)]));
    expect(ids(congress)).toEqual([J(8)]);
  });

  it("vínculos anteriores só entram quando 'atuação atual' é desmarcada, e são sinalizados", async () => {
    const current = await search({ p_category_ids: [await db.category("politica")], p_state_code: "PI" });
    expect(ids(current)).not.toContain(J(4));
    const any = await search({ p_category_ids: [await db.category("politica")], p_state_code: "PI", p_current_only: false });
    const diego = any.items.find((i) => i.id === J(4))!;
    expect(diego.matched_current).toBe(false);
    expect(diego.current_employments[0]!.outlet.name).toBe("Diário Exemplo Carioca");
  });

  it("filtros individuais: cidade, veículo, cargo", async () => {
    const [niteroi] = await db.sys<{ id: string }>("select id from public.locations where ibge_code = '3303302'");
    expect(ids(await search({ p_location_id: niteroi!.id }))).toEqual([J(6)]);
    expect(ids(await search({ p_outlet_id: O(8) }))).toEqual([J(8), J(17)].sort());
    expect(ids(await search({ p_job_title: "editor" }))).toEqual([J(2), J(7), J(17)].sort());
  });

  it("jornalista com dois vínculos simultâneos aparece pelos dois", async () => {
    expect(ids(await search({ p_outlet_id: O(7) }))).toEqual([J(7)]);
    expect(ids(await search({ p_outlet_id: O(10), p_category_ids: [await db.category("economia")] }))).toEqual([J(7)]);
    const r = await search({ p_outlet_id: O(7) });
    expect(r.items[0]!.current_employments).toHaveLength(2);
  });

  it("busca textual ignora acentos e cobre nome profissional e temas", async () => {
    expect(ids(await search({ p_query: "fabio" }))).toEqual([J(6)]);
    expect(ids(await search({ p_query: "Gabi Nunes" }))).toEqual([J(7)]);
    expect(ids(await search({ p_query: "orcamento publico" }))).toEqual([J(1), J(8)].sort());
  });

  it("perfis ocultos e unificados nunca aparecem para usuários", async () => {
    const r = await search({ p_query: "Rafael Exemplo Oculto" });
    expect(r.total).toBe(0);
    await db.sys("update public.journalists set merged_into_id = $1 where id = $2", [J(1), J(14)]);
    expect(ids(await search({ p_query: "ana", p_current_only: false }))).not.toContain(J(14));
  });

  it("somente confirmados e somente com contato", async () => {
    const confirmed = await search({ p_verified_only: true, p_state_code: "PI" });
    expect(confirmed.items.every((i) => i.verification_status === "confirmado")).toBe(true);
    expect(ids(confirmed)).toEqual([J(1)]);
    const withContact = await search({ p_has_contact: true, p_state_code: "PI" });
    // Bruno tem contato apenas restrito -> não conta
    expect(ids(withContact)).toEqual([J(1)]);
  });

  it("prioriza vínculos atuais confirmados na ordenação por relevância", async () => {
    const r = await search({ p_category_ids: [await db.category("politica")], p_state_code: "PI", p_current_only: false });
    expect(r.items[0]!.verification_status).toBe("confirmado");
    expect(r.items.at(-1)!.matched_current).toBe(false);
  });

  it("paginação, total e ordenação por nome", async () => {
    const p1 = await search({ p_sort: "nome", p_page: 1, p_page_size: 5 });
    const p2 = await search({ p_sort: "nome", p_page: 2, p_page_size: 5 });
    expect(p1.items).toHaveLength(5);
    expect(p1.total).toBe(p2.total);
    expect(p1.total).toBe(18); // 20 fichas do seed - 1 oculta - 1 apenas com vínculo antigo (Ana E. Ribeiro)
    const names = [...p1.items, ...p2.items].map((i) => i.full_name);
    expect([...names].sort((a, b) => a.localeCompare(b, "pt-BR"))).toEqual(names);
    // Sem repetição entre páginas (ids; há homônimos no seed)
    expect(new Set([...p1.items, ...p2.items].map((i) => i.id)).size).toBe(10);
  });

  it("limita tamanho de página e bloqueia varredura profunda", async () => {
    expect((await search({ p_page_size: 1000 })).items.length).toBeLessThanOrEqual(50);
    await expectDenied(search({ p_page: 60, p_page_size: 20 }), /paginação limitada/);
  });

  it("limite de buscas por minuto", async () => {
    await db.sys("update public.app_settings set value = '3' where key = 'rate_limit.search_per_minute'");
    for (let i = 0; i < 3; i++) await search({});
    await expectDenied(search({}), /Limite de uso/);
  });

  it("perfil detalhado separa vínculos atuais e históricos e não expõe contatos", async () => {
    const [row] = await db.as<{ p: Record<string, unknown> & { current_employments: unknown[]; past_employments: unknown[] } }>(user, "select public.get_journalist_profile($1) as p", [J(4)]);
    expect(row!.p.current_employments).toHaveLength(1);
    expect(row!.p.past_employments).toHaveLength(1);
    expect(JSON.stringify(row!.p)).not.toContain("@");
    const [hidden] = await db.as<{ p: unknown }>(user, "select public.get_journalist_profile($1) as p", [J(19)]);
    expect(hidden!.p).toBeNull();
  });
});
