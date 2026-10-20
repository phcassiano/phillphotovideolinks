import { describe, expect, it } from "vitest";
import { rankCandidates } from "@/lib/pauta/ranker";
import { RuleBasedPautaInterpreter } from "@/lib/pauta/rule-interpreter";
import { employment, searchItem } from "./fixtures";

const interpreter = new RuleBasedPautaInterpreter();

describe("interpretação de pautas (regras, sem IA externa)", () => {
  it("exemplo do enunciado: cultura + Congresso Nacional, alcance nacional", async () => {
    const i = await interpreter.interpret("Projeto de lei sobre incentivos à cultura será votado no Congresso Nacional.");
    expect(i.categorySlugs).toEqual(expect.arrayContaining(["cultura", "congresso-nacional"]));
    expect(i.scope).toBe("nacional");
    expect(i.explanation.length).toBeGreaterThan(0);
  });

  it("identifica estado citado sem confundir 'para' com Pará", async () => {
    const pi = await interpreter.interpret("Festival de música em Teresina, no Piauí, com shows gratuitos");
    expect(pi.stateCodes).toEqual(["PI"]);
    const para = await interpreter.interpret("Programa de saúde para idosos");
    expect(para.stateCodes).toEqual([]);
    const realPara = await interpreter.interpret("Desmatamento cresce no Pará segundo levantamento");
    expect(realPara.stateCodes).toEqual(["PA"]);
  });
});

describe("ranking transparente", () => {
  const slugs = new Map([["c-pol", "politica"], ["c-cul", "cultura"]]);
  const cultura = employment("e-c", "o-diario-rj", { categories: [{ id: "c-cul", name: "Cultura", parent_id: null }], location: { id: "l-rj", state_code: "RJ", state_name: "Rio de Janeiro", city_name: "Rio de Janeiro" } });
  const politica = employment("e-p", "o-portal-pi");

  it("ordena apenas candidatos existentes e explica os motivos", () => {
    const candidates = [searchItem("j1", "Cultura RJ", [cultura]), searchItem("j2", "Política PI", [politica])];
    const ranked = rankCandidates(candidates, { categorySlugs: ["cultura"], stateCodes: ["RJ"], scope: "estadual", keywords: [], explanation: [] }, slugs);
    expect(ranked.map((r) => r.journalist.id)).toEqual(["j1"]);
    expect(ranked[0]!.reasons.join(" ")).toContain("Cultura");
    expect(ranked[0]!.reasons.join(" ")).toContain("RJ");
    for (const r of ranked) expect(candidates).toContain(r.journalist);
  });

  it("sem aderência temática, ninguém é recomendado só por estar confirmado", () => {
    const ranked = rankCandidates([searchItem("j2", "Política PI", [politica], { has_contact: true })], { categorySlugs: ["esportes"], stateCodes: [], scope: "indefinida", keywords: [], explanation: [] }, slugs);
    expect(ranked).toEqual([]);
  });
});
