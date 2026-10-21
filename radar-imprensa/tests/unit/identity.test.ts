import { describe, expect, it } from "vitest";
import { assessDuplicatePair } from "@/lib/identity/duplicates";
import { jaroWinkler, nameSimilarity, nameTokens } from "@/lib/identity/names";

const base = { sharedOutlets: 0, sharedIdentifiers: 0, conflictingIdentifiers: 0, sharedBylines: 0 };

describe("similaridade de nomes", () => {
  it("ignora acentos, caixa e partículas", () => {
    expect(nameTokens("José da Silva Júnior")).toEqual(["jose", "silva", "junior"]);
    expect(nameSimilarity("Fábio Costa", "fabio costa")).toBe(1);
  });

  it("reconhece abreviações do nome do meio", () => {
    expect(nameSimilarity("Ana E. Ribeiro", "Ana Exemplo Ribeiro")).toBeGreaterThan(0.85);
  });

  it("diferencia nomes distintos", () => {
    expect(nameSimilarity("Ana Ribeiro", "Bruno Lima")).toBeLessThan(0.5);
    expect(jaroWinkler("", "x")).toBe(0);
  });
});

describe("avaliação de duplicidades", () => {
  it("nunca unifica automaticamente, mesmo com sinais fortes", () => {
    const a = assessDuplicatePair({ ...base, nameA: "Ana Exemplo Ribeiro", nameB: "Ana E. Ribeiro", professionalNameA: "Ana Ribeiro", professionalNameB: "Ana Ribeiro", sharedOutlets: 1, sharedBylines: 1, sharedIdentifiers: 1 });
    expect(a.level).toBe("forte");
    expect(a.autoMerge).toBe(false);
    expect(a.shouldSuggest).toBe(true);
  });

  it("homônimos sem evidência cruzada não viram sugestão forte", () => {
    const a = assessDuplicatePair({ ...base, nameA: "Ana Exemplo Ribeiro", nameB: "Ana Exemplo Ribeiro" });
    expect(a.score).toBeLessThan(0.5);
    expect(a.shouldSuggest).toBe(false);
    expect(a.reasons.join(" ")).toContain("homônimo");
  });

  it("registros profissionais diferentes derrubam a pontuação", () => {
    const a = assessDuplicatePair({ ...base, nameA: "Ana Exemplo Ribeiro", nameB: "Ana Exemplo Ribeiro", sharedOutlets: 1, conflictingIdentifiers: 1 });
    expect(a.score).toBeLessThan(0.3);
    expect(a.reasons.some((r) => r.includes("DIFERENTES"))).toBe(true);
  });

  it("mudança de veículo não impede a identificação (mesma assinatura e histórico)", () => {
    const a = assessDuplicatePair({ ...base, nameA: "Diego Teste Andrade", nameB: "Diego T. Andrade", sharedOutlets: 1, sharedBylines: 2 });
    expect(a.shouldSuggest).toBe(true);
  });
});
