import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, hasActiveFilters, parseSearchParams, toRpcArgs, toSearchParams, totalPages } from "@/lib/search/filters";

const POLITICA = "11111111-1111-4111-8111-111111111111";
const SUB = "22222222-2222-4222-8222-222222222222";

describe("filtros de busca na URL", () => {
  it("usa padrões seguros quando a URL está vazia", () => {
    expect(parseSearchParams({})).toEqual(DEFAULT_FILTERS);
    expect(parseSearchParams({}).atual).toBe(true);
  });

  it("combina editoria, estado e tipo de veículo (ex.: Política + PI + Portal)", () => {
    const f = parseSearchParams({ editoria: POLITICA, uf: "pi", tipo: "portal" });
    expect(f).toMatchObject({ editoria: POLITICA, uf: "PI", tipo: ["portal"] });
    const args = toRpcArgs(f);
    expect(args.p_category_ids).toEqual([POLITICA]);
    expect(args.p_state_code).toBe("PI");
    expect(args.p_outlet_types).toEqual(["portal"]);
    expect(args.p_current_only).toBe(true);
  });

  it("subeditoria é mais específica que a editoria", () => {
    expect(toRpcArgs(parseSearchParams({ editoria: POLITICA, subeditoria: SUB })).p_category_ids).toEqual([SUB]);
  });

  it("descarta valores manipulados em vez de quebrar", () => {
    const f = parseSearchParams({ editoria: "'; drop table x;--", uf: "XX", tipo: ["portal", "hacker"], ordem: "evil", pagina: "-5" });
    expect(f.editoria).toBeUndefined();
    expect(f.uf).toBeUndefined();
    expect(f.tipo).toEqual(["portal"]);
    expect(f.ordem).toBe("relevancia");
    expect(f.pagina).toBe(1);
  });

  it("aceita vários tipos de mídia e remove duplicados", () => {
    expect(parseSearchParams(new URLSearchParams("tipo=tv&tipo=radio,tv")).tipo).toEqual(["tv", "radio"]);
  });

  it("atual=0 inclui vínculos anteriores", () => {
    expect(parseSearchParams({ atual: "0" }).atual).toBe(false);
    expect(toRpcArgs(parseSearchParams({ atual: "0" })).p_current_only).toBe(false);
  });

  it("serialização e leitura são inversas (filtros persistidos na URL)", () => {
    const f = parseSearchParams({ q: "Ana", editoria: POLITICA, uf: "RJ", tipo: ["tv", "portal"], contato: "1", verificados: "1", atual: "0", ordem: "nome", pagina: "3" });
    expect(parseSearchParams(toSearchParams(f))).toEqual(f);
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe("");
  });

  it("limita o texto da busca e o número de páginas", () => {
    expect(parseSearchParams({ q: "a".repeat(500) }).q).toHaveLength(120);
    expect(totalPages(5000, 20)).toBe(50); // máximo de 1000 resultados navegáveis
    expect(totalPages(0, 20)).toBe(1);
  });

  it("detecta filtros ativos", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, uf: "PI" })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, atual: false })).toBe(true);
  });
});
