import { describe, expect, it } from "vitest";
import { EvidenceChangeDetector } from "@/lib/verification/detector";
import { SnippetExtractor } from "@/lib/verification/extractor";
import { DemoSearchProvider, demoScenarioFor } from "@/lib/verification/providers/demo-provider";
import { NullSearchProvider } from "@/lib/verification/providers/null-provider";
import { ConservativeEntityResolver } from "@/lib/verification/resolver";
import { VerificationService, buildQuery } from "@/lib/verification/service";
import type { ResolvedEvidence, SearchProvider, SearchResultItem } from "@/lib/verification/types";
import { MemoryRepository, OUTLETS, employment, snapshot } from "./fixtures";

const NOW = new Date("2026-10-20T12:00:00Z");
const extractor = new SnippetExtractor();
const resolver = new ConservativeEntityResolver();
const detector = new EvidenceChangeDetector({ now: NOW });

function resolved(results: SearchResultItem[], snap = snapshot()): ResolvedEvidence[] {
  return results.map((r) => {
    const e = extractor.extract(r, { knownOutlets: OUTLETS });
    return { ...e, resolution: resolver.resolve(snap, e) };
  });
}

const result = (url: string, title: string, snippet = "", publishedAt: string | null = "2026-10-10T00:00:00Z"): SearchResultItem => ({ url, title, snippet, publishedAt, provider: "teste" });

class StaticProvider implements SearchProvider {
  readonly name = "estatico";
  readonly isConfigured = true;
  readonly isDemo = false;
  constructor(private readonly results: SearchResultItem[] | Error) {}
  async search() {
    if (this.results instanceof Error) throw this.results;
    return this.results;
  }
}

function service(provider: SearchProvider, repo: MemoryRepository) {
  return new VerificationService({ provider, extractor, resolver, detector, repository: repo });
}

describe("extrator e resolvedor", () => {
  it("reconhece veículos cadastrados por nome ou domínio e e-mails literais", () => {
    const e = extractor.extract(result("https://portal-exemplo-pi.example/equipe", "Equipe", "Ana Ribeiro, repórter. Contato: ana.nova@portal-exemplo-pi.example"), { knownOutlets: OUTLETS });
    expect(e.evidenceType).toBe("expediente");
    expect(e.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "employment", outletId: "o-portal-pi", jobTitle: "Repórter" }),
      { kind: "contact", contactType: "email_profissional", value: "ana.nova@portal-exemplo-pi.example" },
    ]));
  });

  it("não cria veículos a partir de texto livre", () => {
    const e = extractor.extract(result("https://outro.example/x", "Ana Ribeiro no Jornal Desconhecido"), { knownOutlets: OUTLETS });
    expect(e.claims.filter((c) => c.kind === "employment")).toHaveLength(0);
  });

  it("nome sozinho tem confiança limitada; histórico conhecido reforça", () => {
    const onlyName = resolved([result("https://x.example/a", "Ana Ribeiro fala sobre eleições")])[0]!;
    const withOutlet = resolved([result("https://x.example/b", "Por Ana Ribeiro — Portal Exemplo Piauí")])[0]!;
    expect(onlyName.resolution.confidence).toBeLessThanOrEqual(0.6);
    expect(withOutlet.resolution.confidence).toBeGreaterThan(onlyName.resolution.confidence);
  });

  it("rejeita fontes que não citam o jornalista", () => {
    expect(resolved([result("https://x.example/c", "Portal Exemplo Piauí lança aplicativo")])[0]!.resolution.matches).toBe(false);
  });
});

describe("detector de mudanças", () => {
  it("propõe confirmação quando fontes recentes corroboram o vínculo atual", () => {
    const d = detector.detect(snapshot(), resolved([
      result("https://portal-exemplo-pi.example/equipe", "Expediente", "Ana Ribeiro, repórter de política do Portal Exemplo Piauí"),
      result("https://agregador.example/x", "Por Ana Ribeiro — Portal Exemplo Piauí"),
    ]));
    expect(d.changes).toEqual([{ op: "confirm_current" }]);
    expect(d.corroboratedEmploymentIds).toEqual(["e-1"]);
  });

  it("não propõe reconfirmar quem foi confirmado recentemente", () => {
    const snap = snapshot({ verification_status: "confirmado", last_verified_at: "2026-10-01T00:00:00Z" });
    const d = detector.detect(snap, resolved([result("https://portal-exemplo-pi.example/equipe", "Expediente", "Ana Ribeiro — Portal Exemplo Piauí")], snap));
    expect(d.changes).toEqual([]);
  });

  it("propõe novo vínculo sem apagar o atual quando há só uma fonte", () => {
    const d = detector.detect(snapshot(), resolved([result("https://diario-exemplo-carioca.example/equipe", "Ana Ribeiro é a nova editora", "Ana Ribeiro, editora do Diário Exemplo Carioca")]));
    expect(d.changes).toEqual([{ op: "add_employment", media_outlet_id: "o-diario-rj", job_title: "Editora" }]);
    expect(d.changes.some((c) => c.op === "end_employment")).toBe(false);
  });

  it("sugere encerrar o vínculo atual apenas com 2+ fontes independentes do novo", () => {
    const d = detector.detect(snapshot(), resolved([
      result("https://diario-exemplo-carioca.example/equipe", "Ana Ribeiro, editora do Diário Exemplo Carioca"),
      result("https://agencia.example/n", "Ana Ribeiro assume no Diário Exemplo Carioca"),
    ]));
    expect(d.changes).toEqual(expect.arrayContaining([{ op: "end_employment", employment_id: "e-1" }]));
  });

  it("ignora evidências antigas para mudanças de emprego", () => {
    const d = detector.detect(snapshot(), resolved([result("https://diario-exemplo-carioca.example/a", "Ana Ribeiro no Diário Exemplo Carioca", "", "2023-01-01T00:00:00Z")]));
    expect(d.changes).toEqual([]);
  });

  it("propõe contatos literalmente citados como restritos e não repete os já cadastrados", () => {
    const d = detector.detect(snapshot(), resolved([
      result("https://portal-exemplo-pi.example/equipe", "Ana Ribeiro — Portal Exemplo Piauí", "ana.ribeiro@portal-exemplo-pi.example / pautas.ana@portal-exemplo-pi.example"),
    ]));
    expect(d.changes).toContainEqual({ op: "add_contact", contact_type: "email_profissional", contact_value: "pautas.ana@portal-exemplo-pi.example", visibility: "restrito" });
    expect(d.changes.filter((c) => c.op === "add_contact")).toHaveLength(1);
  });

  it("sinaliza possível homônimo quando a correspondência é só pelo nome", () => {
    const snap = snapshot({ current_employments: [employment("e-1", "o-gazeta")] });
    const d = detector.detect(snap, resolved([result("https://diario-exemplo-carioca.example/x", "Ana Exemplo Ribeiro no Diário Exemplo Carioca")], snap));
    expect(d.description).toContain("homônimo");
  });
});

describe("serviço de verificação", () => {
  it("sem provedor configurado, registra 'ignorada' sem simular resultados", async () => {
    const repo = new MemoryRepository([{ id: "job1", journalist_id: "j-ana", attempts: 1 }], { "j-ana": snapshot() });
    const report = await service(new NullSearchProvider(), repo).runBatch(10);
    expect(report).toMatchObject({ claimed: 1, skipped: 1, completed: 0 });
    expect(repo.outcomes[0]!.outcome.outcome).toBe("ignorada");
  });

  it("processa apenas o tamanho de lote pedido", async () => {
    const jobs = Array.from({ length: 25 }, (_, i) => ({ id: `job${i}`, journalist_id: "j-ana", attempts: 1 }));
    const repo = new MemoryRepository(jobs, { "j-ana": snapshot() });
    const report = await service(new StaticProvider([]), repo).runBatch(10);
    expect(report.claimed).toBe(10);
    expect(repo.jobs).toHaveLength(15);
  });

  it("registra evidências e uma proposta sensível para revisão", async () => {
    const repo = new MemoryRepository([{ id: "job1", journalist_id: "j-ana", attempts: 1 }], { "j-ana": snapshot() });
    const provider = new StaticProvider([result("https://diario-exemplo-carioca.example/equipe", "Ana Ribeiro, editora do Diário Exemplo Carioca")]);
    const report = await service(provider, repo).runBatch(5);
    expect(report).toMatchObject({ completed: 1, proposals: 1, evidence: 1 });
    const outcome = repo.outcomes[0]!.outcome;
    if (outcome.outcome !== "concluida") throw new Error("esperava concluída");
    expect(outcome.evidence[0]).toMatchObject({ source_url: "https://diario-exemplo-carioca.example/equipe", is_demo: false });
    expect(outcome.proposal).toMatchObject({ sensitive: true, is_demo: false });
    expect(outcome.proposal!.description).toContain("revisão humana obrigatória");
  });

  it("falhas do provedor viram 'falhou' (com mensagem) sem interromper o lote", async () => {
    const repo = new MemoryRepository(
      [{ id: "job1", journalist_id: "j-ana", attempts: 1 }, { id: "job2", journalist_id: "j-ana", attempts: 1 }],
      { "j-ana": snapshot() },
    );
    const report = await service(new StaticProvider(new Error("timeout da API")), repo).runBatch(5);
    expect(report.failed).toBe(2);
    expect(repo.outcomes.map((o) => o.outcome.outcome)).toEqual(["falhou", "falhou"]);
  });

  it("perfil removido durante a fila é ignorado", async () => {
    const repo = new MemoryRepository([{ id: "job1", journalist_id: "j-x", attempts: 1 }], {});
    expect((await service(new StaticProvider([]), repo).runBatch(1)).skipped).toBe(1);
  });

  it("monta a consulta com nome e veículo atual", () => {
    expect(buildQuery("Ana Ribeiro", ["Portal Exemplo Piauí"])).toBe('"Ana Ribeiro" jornalista "Portal Exemplo Piauí"');
  });
});

describe("provedor demonstrativo", () => {
  it("gera somente evidências fictícias marcadas como demonstrativas", async () => {
    const snap = snapshot();
    const repo = new MemoryRepository([], { "j-ana": snap });
    const provider = new DemoSearchProvider(repo, () => NOW, () => "corrobora");
    const results = await provider.search({ journalistId: "j-ana", text: "x" });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.isDemo).toBe(true);
      expect(new URL(r.url).hostname.endsWith(".example")).toBe(true);
      expect(r.title).toContain("[DEMONSTRATIVO]");
    }
  });

  it("cenário de mudança gera proposta marcada como demonstrativa", async () => {
    const repo = new MemoryRepository([{ id: "job1", journalist_id: "j-ana", attempts: 1 }], { "j-ana": snapshot() });
    const provider = new DemoSearchProvider(repo, () => NOW, () => "mudanca");
    await service(provider, repo).runBatch(1);
    const outcome = repo.outcomes[0]!.outcome;
    if (outcome.outcome !== "concluida") throw new Error("esperava concluída");
    expect(outcome.proposal?.is_demo).toBe(true);
    expect(outcome.evidence.every((e) => e.is_demo && e.evidence_type === "demonstrativa")).toBe(true);
  });

  it("cenário de erro permite testar novas tentativas", async () => {
    const repo = new MemoryRepository([{ id: "job1", journalist_id: "j-ana", attempts: 1 }], { "j-ana": snapshot() });
    await service(new DemoSearchProvider(repo, () => NOW, () => "erro"), repo).runBatch(1);
    expect(repo.outcomes[0]!.outcome.outcome).toBe("falhou");
  });

  it("distribui cenários de forma determinística", () => {
    expect(demoScenarioFor("abc")).toBe(demoScenarioFor("abc"));
  });
});
