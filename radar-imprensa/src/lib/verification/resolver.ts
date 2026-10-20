import { nameTokens, normalizeText } from "@/lib/identity/names";
import type { EntityResolver, ExtractedEvidence, JournalistSnapshot, ResolutionResult } from "./types";

// Resolvedor conservador: o nome sozinho nunca gera alta confiança, pois
// homônimos são comuns. Vínculos conhecidos (atuais ou antigos) reforçam.
export class ConservativeEntityResolver implements EntityResolver {
  constructor(private readonly minConfidence = 0.5) {}

  resolve(snapshot: JournalistSnapshot, evidence: ExtractedEvidence): ResolutionResult {
    const reasons: string[] = [];
    const names = [snapshot.full_name, snapshot.professional_name].filter((n): n is string => Boolean(n));
    let nameScore = 0;
    for (const name of names) {
      const normalized = normalizeText(name);
      if (normalized && evidence.text.includes(normalized)) {
        nameScore = Math.max(nameScore, 0.6);
        continue;
      }
      const tokens = nameTokens(name);
      if (tokens.length >= 2) {
        const first = tokens[0]!;
        const last = tokens[tokens.length - 1]!;
        const re = (t: string) => new RegExp(`\\b${t}\\b`);
        if (re(first).test(evidence.text) && re(last).test(evidence.text)) nameScore = Math.max(nameScore, 0.45);
      }
    }
    if (nameScore === 0) {
      return { matches: false, confidence: 0, reasons: ["Nome não encontrado na fonte"] };
    }
    reasons.push(nameScore >= 0.6 ? "Nome completo ou profissional citado" : "Primeiro e último nome citados");

    const knownOutletIds = new Set(
      [...snapshot.current_employments, ...snapshot.past_employments].map((e) => e.outlet.id),
    );
    const mentionsKnownOutlet = evidence.claims.some((c) => c.kind === "employment" && knownOutletIds.has(c.outletId));
    let confidence = nameScore;
    if (mentionsKnownOutlet) {
      confidence += 0.25;
      reasons.push("Fonte cita veículo do histórico do jornalista");
    }
    const knownEmails = new Set(snapshot.contacts.map((c) => c.contact_value.toLowerCase()));
    if (evidence.claims.some((c) => c.kind === "contact" && knownEmails.has(c.value))) {
      confidence += 0.2;
      reasons.push("Fonte cita contato já cadastrado");
    }
    if (evidence.result.isDemo) reasons.push("Evidência demonstrativa (fictícia)");

    confidence = Math.min(0.95, Math.round(confidence * 1000) / 1000);
    return { matches: confidence >= this.minConfidence, confidence, reasons };
  }
}
