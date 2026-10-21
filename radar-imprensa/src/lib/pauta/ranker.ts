import type { JournalistSearchItem } from "@/lib/domain/types";
import { normalizeText } from "@/lib/identity/names";
import type { PautaInterpretation, RankedCandidate } from "./types";

// Ranking transparente: cada ponto tem um motivo legível.
const STATUS_POINTS: Record<JournalistSearchItem["verification_status"], number> = {
  confirmado: 15,
  provavel: 8,
  em_revisao: 4,
  nao_verificado: 2,
  desatualizado: 0,
};

export function rankCandidates(
  candidates: JournalistSearchItem[],
  interpretation: PautaInterpretation,
  categorySlugById: Map<string, string>,
): RankedCandidate[] {
  const wanted = new Set(interpretation.categorySlugs);
  const states = new Set(interpretation.stateCodes);

  return candidates
    .map((journalist) => {
      let score = 0;
      const reasons: string[] = [];
      const current = journalist.current_employments;

      const matchedCategories = new Set<string>();
      for (const e of current) {
        for (const c of e.categories) {
          const slug = categorySlugById.get(c.id);
          if (slug && wanted.has(slug)) matchedCategories.add(c.name);
        }
      }
      if (matchedCategories.size) {
        score += 30 + 10 * (matchedCategories.size - 1);
        reasons.push(`Cobre ${[...matchedCategories].join(", ")} no vínculo atual`);
      }

      const inState = current.find((e) => e.location && states.has(e.location.state_code));
      if (inState?.location) {
        score += 20;
        reasons.push(`Atua em ${inState.location.city_name ?? inState.location.state_name}/${inState.location.state_code}`);
      } else if (interpretation.scope === "nacional" && current.some((e) => e.location?.state_code === "DF")) {
        score += 10;
        reasons.push("Baseado em Brasília (pauta de alcance nacional)");
      }

      const titleText = normalizeText(current.map((e) => e.job_title ?? "").join(" "));
      const keywordHits = interpretation.keywords.filter((k) => titleText.includes(k));
      if (keywordHits.length) {
        score += 5 * keywordHits.length;
        reasons.push(`Cargo relacionado a: ${keywordHits.join(", ")}`);
      }

      score += STATUS_POINTS[journalist.verification_status];
      reasons.push(`Situação: ${journalist.verification_status.replace("_", " ")}`);
      if (journalist.has_contact) {
        score += 5;
        reasons.push("Possui contato profissional disponível");
      }
      return { journalist, score, reasons };
    })
    .filter((r) => r.score > STATUS_POINTS.confirmado + 5) // exige aderência além do status/contato
    .sort((a, b) => b.score - a.score || a.journalist.full_name.localeCompare(b.journalist.full_name, "pt-BR"));
}
