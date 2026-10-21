import type { JournalistSnapshot, KnownOutlet, SearchProvider, SearchQuery, SearchResultItem } from "../types";

// Provedor DEMONSTRATIVO: gera evidências FICTÍCIAS e determinísticas para testar
// o fluxo de verificação sem acessar a internet. Todas as URLs usam o domínio
// reservado ".example" e todos os resultados são marcados como demonstrativos.
// Nunca deve ser usado como fonte de verdade.

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface DemoDataSource {
  getSnapshot(journalistId: string): Promise<JournalistSnapshot | null>;
  listKnownOutlets(): Promise<KnownOutlet[]>;
}

export type DemoScenario = "corrobora" | "mudanca" | "sem_resultado" | "erro";

export function demoScenarioFor(journalistId: string): DemoScenario {
  const h = hash(journalistId) % 10;
  if (h < 5) return "corrobora";
  if (h < 8) return "mudanca";
  if (h < 9) return "sem_resultado";
  return "erro";
}

export class DemoSearchProvider implements SearchProvider {
  readonly name = "demonstrativo";
  readonly isConfigured = true;
  readonly isDemo = true;

  constructor(
    private readonly data: DemoDataSource,
    private readonly now: () => Date = () => new Date(),
    private readonly scenarioFor: (journalistId: string) => DemoScenario = demoScenarioFor,
  ) {}

  async search(query: SearchQuery): Promise<SearchResultItem[]> {
    const snapshot = await this.data.getSnapshot(query.journalistId);
    if (!snapshot) return [];
    const scenario = this.scenarioFor(snapshot.id);
    const name = snapshot.professional_name ?? snapshot.full_name;
    const slug = snapshot.id.slice(0, 8);
    const publishedAt = new Date(this.now().getTime() - 7 * 86_400_000).toISOString();
    const base = `https://demo.radar-imprensa.example/${slug}`;

    switch (scenario) {
      case "sem_resultado":
        return [];
      case "erro":
        throw new Error("Falha simulada pelo provedor demonstrativo (teste de nova tentativa).");
      case "mudanca": {
        const outlets = await this.data.listKnownOutlets();
        const currentIds = new Set(snapshot.current_employments.map((e) => e.outlet.id));
        const candidates = outlets.filter((o) => !currentIds.has(o.id));
        const target = candidates[hash(snapshot.id + "o") % Math.max(candidates.length, 1)];
        if (!target) return [];
        return [
          {
            url: `${base}/nova-funcao`,
            title: `[DEMONSTRATIVO] ${name} assume como repórter no ${target.name}`,
            snippet: `Conteúdo fictício gerado para testes: ${name} passa a integrar a equipe do ${target.name} como repórter.`,
            publishedAt,
            provider: this.name,
            isDemo: true,
          },
        ];
      }
      case "corrobora":
      default:
        return snapshot.current_employments.slice(0, 2).map((e, i) => ({
          url: `${base}/materia-${i + 1}`,
          title: `[DEMONSTRATIVO] Matéria assinada por ${name} — ${e.outlet.name}`,
          snippet: `Conteúdo fictício gerado para testes: reportagem por ${name}, ${e.job_title ?? "jornalista"} do ${e.outlet.name}.`,
          publishedAt,
          provider: this.name,
          isDemo: true,
        }));
    }
  }
}
