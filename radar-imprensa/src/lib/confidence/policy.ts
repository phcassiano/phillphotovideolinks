import type { EvidenceType, VerificationStatus } from "@/lib/domain/enums";

// Política conservadora de confiança (seção 11).
// A pontuação numérica apoia a decisão, mas nunca é prova isolada.

export type ChangeOp =
  | { op: "confirm_current" }
  | { op: "set_field"; field: "professional_name" | "biography" | "professional_status"; value: string }
  | { op: "set_verification_status"; value: VerificationStatus }
  | { op: "end_employment"; employment_id: string; end_date?: string }
  | {
      op: "add_employment";
      media_outlet_id: string;
      job_title?: string | null;
      location_id?: string | null;
      category_ids?: string[];
      start_date?: string | null;
    }
  | {
      op: "add_contact";
      contact_type: "email_profissional" | "telefone_profissional" | "formulario_contato";
      contact_value: string;
      visibility?: "assinantes" | "restrito";
      employment_id?: string | null;
      professional_purpose?: string | null;
    }
  | { op: "update_contact_status"; contact_id: string; verification_status: VerificationStatus }
  | { op: "add_topic"; topic_name: string };

const SENSITIVE_OPS = new Set<ChangeOp["op"]>(["add_employment", "end_employment", "add_contact", "update_contact_status"]);

export function isSensitiveChange(change: ChangeOp): boolean {
  return SENSITIVE_OPS.has(change.op);
}

// Peso de cada tipo de evidência como sustentação de dados profissionais.
const EVIDENCE_WEIGHT: Record<EvidenceType, number> = {
  declaracao_titular: 1,
  perfil_institucional: 0.9,
  expediente: 0.85,
  assinatura_materia: 0.6,
  cadastro_manual: 0.5,
  busca_automatizada: 0.4,
  importacao: 0.3,
  demonstrativa: 0,
};

export interface EvidenceSignal {
  evidenceType: EvidenceType;
  confidence: number; // 0..1 (correspondência de identidade + extração)
  sourceDomain?: string | null;
  isDemo?: boolean;
}

// Combina evidências independentes (por domínio) em uma confiança agregada.
export function aggregateConfidence(signals: EvidenceSignal[]): number {
  const byDomain = new Map<string, number>();
  for (const s of signals) {
    if (s.isDemo) continue;
    const value = Math.max(0, Math.min(1, s.confidence)) * EVIDENCE_WEIGHT[s.evidenceType];
    const key = s.sourceDomain ?? `__${byDomain.size}`;
    byDomain.set(key, Math.max(byDomain.get(key) ?? 0, value));
  }
  // 1 - Π(1 - p): fontes independentes reforçam, mas nunca chegam a 1 sozinhas.
  let remaining = 1;
  for (const p of byDomain.values()) remaining *= 1 - p;
  return Math.round((1 - remaining) * 1000) / 1000;
}

export interface ReviewDecision {
  requiresHumanReview: boolean;
  autoApplicable: boolean;
  reasons: string[];
}

export interface PolicyOptions {
  // Desativado por padrão. Mesmo quando ativado, só alcança mudanças não sensíveis.
  allowAutoApplyNonSensitive?: boolean;
  minAutoApplyConfidence?: number;
  minIndependentSources?: number;
}

// Decide se uma proposta pode ser aplicada sem revisão humana.
// Mudanças de emprego/contato SEMPRE exigem revisão; evidências demonstrativas
// nunca são suficientes; a IA/automação nunca publica mudanças sensíveis.
export function decideReview(
  changes: ChangeOp[],
  signals: EvidenceSignal[],
  options: PolicyOptions = {},
): ReviewDecision {
  const reasons: string[] = [];
  const sensitive = changes.some(isSensitiveChange);
  const confirms = changes.some(
    (c) => c.op === "confirm_current" || (c.op === "set_verification_status" && c.value === "confirmado"),
  );
  const realSignals = signals.filter((s) => !s.isDemo);
  const independent = new Set(realSignals.map((s, i) => s.sourceDomain ?? `__${i}`)).size;
  const confidence = aggregateConfidence(signals);

  if (sensitive) reasons.push("Envolve emprego ou contato: revisão humana obrigatória.");
  if (confirms) reasons.push("Confirmação profissional exige revisão humana ou declaração do titular.");
  if (realSignals.length === 0) reasons.push("Sem evidências reais (apenas demonstrativas ou nenhuma).");

  const minConfidence = options.minAutoApplyConfidence ?? 0.9;
  const minSources = options.minIndependentSources ?? 2;
  const autoApplicable =
    Boolean(options.allowAutoApplyNonSensitive) &&
    !sensitive &&
    !confirms &&
    realSignals.length > 0 &&
    confidence >= minConfidence &&
    independent >= minSources;

  if (!autoApplicable && !sensitive && !confirms && realSignals.length > 0) {
    reasons.push(
      options.allowAutoApplyNonSensitive
        ? `Confiança ${confidence} ou fontes independentes (${independent}) abaixo do mínimo.`
        : "Aplicação automática desativada pela política.",
    );
  }
  return { requiresHumanReview: !autoApplicable, autoApplicable, reasons };
}

// Status sugerido a partir das evidências, usado apenas como indicação na revisão.
// Nunca retorna "confirmado": confirmar é ato humano ou do titular.
export function suggestedStatus(signals: EvidenceSignal[]): VerificationStatus {
  const confidence = aggregateConfidence(signals);
  if (confidence >= 0.6) return "provavel";
  return "nao_verificado";
}
