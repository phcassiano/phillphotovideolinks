import { nameSimilarity, normalizeText } from "./names";

// Sinais objetivos sobre um par de registros (vindos de public.duplicate_candidate_pairs).
export interface PairFeatures {
  nameA: string;
  nameB: string;
  professionalNameA?: string | null;
  professionalNameB?: string | null;
  sharedOutlets: number;
  sharedIdentifiers: number;
  conflictingIdentifiers: number;
  sharedBylines: number;
}

export interface DuplicateAssessment {
  score: number;
  level: "forte" | "possivel" | "fraca";
  reasons: string[];
  // Sempre falso: nenhuma unificação é automática (revisão humana obrigatória).
  autoMerge: false;
  shouldSuggest: boolean;
}

export const SUGGESTION_THRESHOLD = 0.5;

export function assessDuplicatePair(f: PairFeatures): DuplicateAssessment {
  const reasons: string[] = [];
  const nameScore = Math.max(
    nameSimilarity(f.nameA, f.nameB),
    f.professionalNameA && f.professionalNameB ? nameSimilarity(f.professionalNameA, f.professionalNameB) * 0.95 : 0,
  );

  let score = nameScore * 0.4;
  if (nameScore >= 0.99) reasons.push("Nomes idênticos (pode ser homônimo)");
  else if (nameScore >= 0.7) reasons.push(`Nomes semelhantes (${Math.round(nameScore * 100)}%)`);

  const sameProfessionalName =
    f.professionalNameA &&
    f.professionalNameB &&
    normalizeText(f.professionalNameA) === normalizeText(f.professionalNameB);
  if (sameProfessionalName) {
    score += 0.08;
    reasons.push("Mesmo nome profissional");
  }
  if (f.sharedOutlets > 0) {
    score += Math.min(f.sharedOutlets, 2) * 0.12;
    reasons.push(`Histórico em ${f.sharedOutlets} veículo(s) em comum`);
  }
  if (f.sharedBylines > 0) {
    score += 0.2;
    reasons.push(`Mesma assinatura em ${f.sharedBylines} matéria(s)`);
  }
  if (f.sharedIdentifiers > 0) {
    score += 0.35;
    reasons.push("Identificador profissional idêntico");
  }
  if (f.conflictingIdentifiers > 0) {
    score *= 0.25;
    reasons.push("Registros profissionais DIFERENTES: provavelmente pessoas distintas");
  }
  if (nameScore >= 0.99 && f.sharedOutlets === 0 && f.sharedBylines === 0 && f.sharedIdentifiers === 0) {
    reasons.push("Sem evidência cruzada além do nome: não unificar sem verificação");
  }

  score = Math.round(Math.min(1, Math.max(0, score)) * 1000) / 1000;
  const level = score >= 0.75 ? "forte" : score >= SUGGESTION_THRESHOLD ? "possivel" : "fraca";
  return { score, level, reasons, autoMerge: false, shouldSuggest: score >= SUGGESTION_THRESHOLD };
}
