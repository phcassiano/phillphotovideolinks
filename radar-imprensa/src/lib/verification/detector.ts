import { aggregateConfidence, type ChangeOp, type EvidenceSignal } from "@/lib/confidence/policy";
import { normalizeText } from "@/lib/identity/names";
import type { ChangeDetector, DetectedChanges, JournalistSnapshot, ResolvedEvidence } from "./types";

export interface DetectorOptions {
  now?: Date;
  // Evidências mais antigas que isso não sustentam mudança de emprego.
  maxEvidenceAgeDays?: number;
  // Confirmações recentes dispensam nova proposta de confirmação.
  reconfirmAfterDays?: number;
  minCorroborationConfidence?: number;
}

function toSignal(e: ResolvedEvidence): EvidenceSignal {
  return {
    evidenceType: e.result.isDemo ? "demonstrativa" : e.evidenceType,
    confidence: e.resolution.confidence,
    sourceDomain: e.sourceDomain,
    isDemo: e.result.isDemo,
  };
}

// Compara o estado atual do registro com as evidências encontradas e propõe
// alterações. Não grava nada: as propostas seguem para revisão humana.
export class EvidenceChangeDetector implements ChangeDetector {
  constructor(private readonly options: DetectorOptions = {}) {}

  detect(snapshot: JournalistSnapshot, evidences: ResolvedEvidence[]): DetectedChanges {
    const now = this.options.now ?? new Date();
    const maxAgeMs = (this.options.maxEvidenceAgeDays ?? 180) * 86_400_000;
    const reconfirmMs = (this.options.reconfirmAfterDays ?? 150) * 86_400_000;
    const minCorroboration = this.options.minCorroborationConfidence ?? 0.75;

    const matched = evidences.filter((e) => e.resolution.matches);
    const recent = matched.filter((e) => {
      if (!e.result.publishedAt) return true;
      const t = new Date(e.result.publishedAt).getTime();
      return Number.isNaN(t) || now.getTime() - t <= maxAgeMs;
    });

    const changes: ChangeOp[] = [];
    const notes: string[] = [];
    const currentByOutlet = new Map(snapshot.current_employments.map((e) => [e.outlet.id, e]));
    const corroborated = new Map<string, ResolvedEvidence[]>();
    const newOutlets = new Map<string, { name: string; jobTitle: string | null; evidence: ResolvedEvidence[] }>();

    for (const e of recent) {
      for (const claim of e.claims) {
        if (claim.kind !== "employment") continue;
        const current = currentByOutlet.get(claim.outletId);
        if (current) {
          corroborated.set(current.id, [...(corroborated.get(current.id) ?? []), e]);
        } else {
          const entry = newOutlets.get(claim.outletId) ?? { name: claim.outletName, jobTitle: claim.jobTitle, evidence: [] };
          entry.evidence.push(e);
          entry.jobTitle ??= claim.jobTitle;
          newOutlets.set(claim.outletId, entry);
        }
      }
    }

    // Novos vínculos
    for (const [outletId, entry] of newOutlets) {
      const confidence = aggregateConfidence(entry.evidence.map(toSignal));
      const best = Math.max(...entry.evidence.map((e) => e.resolution.confidence));
      if (best < 0.6 && !entry.evidence.some((e) => e.result.isDemo)) continue;
      changes.push({ op: "add_employment", media_outlet_id: outletId, job_title: entry.jobTitle });
      const onlyName = entry.evidence.every((e) => e.resolution.reasons.length <= 1);
      notes.push(
        `Possível novo vínculo com "${entry.name}"${entry.jobTitle ? ` (${entry.jobTitle})` : ""} — ` +
          `${entry.evidence.length} fonte(s), confiança ${confidence}.` +
          (onlyName ? " Atenção: correspondência apenas pelo nome (possível homônimo)." : ""),
      );
    }

    // Encerramento de vínculo: somente com 2+ fontes independentes do novo vínculo
    // e nenhuma evidência recente do vínculo atual.
    const strongNew = [...newOutlets.values()].filter(
      (n) => new Set(n.evidence.map((e) => e.sourceDomain)).size >= 2,
    );
    if (strongNew.length > 0) {
      for (const employment of snapshot.current_employments) {
        if (!corroborated.has(employment.id)) {
          changes.push({ op: "end_employment", employment_id: employment.id });
          notes.push(
            `Vínculo atual com "${employment.outlet.name}" sem evidência recente enquanto há fontes de um novo vínculo: verificar se foi encerrado.`,
          );
        }
      }
    }

    // Contatos literalmente presentes em fontes (cadastrados como restritos até revisão)
    const knownContacts = new Set(snapshot.contacts.map((c) => normalizeText(c.contact_value)));
    const proposedEmails = new Set<string>();
    for (const e of recent) {
      for (const claim of e.claims) {
        if (claim.kind !== "contact") continue;
        const key = normalizeText(claim.value);
        if (knownContacts.has(key) || proposedEmails.has(key)) continue;
        proposedEmails.add(key);
        changes.push({ op: "add_contact", contact_type: "email_profissional", contact_value: claim.value, visibility: "restrito" });
        notes.push(`E-mail profissional citado em fonte pública: ${claim.value} (entrará como restrito).`);
      }
    }

    // Confirmação dos vínculos atuais quando a corroboração é forte e não há mudanças
    const corroborationSignals = [...corroborated.values()].flat().map(toSignal);
    const corroborationConfidence = aggregateConfidence(corroborationSignals);
    const allCurrentCorroborated =
      snapshot.current_employments.length > 0 &&
      snapshot.current_employments.every((e) => corroborated.has(e.id));
    const lastVerified = snapshot.last_verified_at ? new Date(snapshot.last_verified_at).getTime() : 0;
    const needsReconfirm = snapshot.verification_status !== "confirmado" || now.getTime() - lastVerified > reconfirmMs;
    const demoCorroboration = [...corroborated.values()].flat().some((e) => e.result.isDemo);
    if (
      changes.length === 0 &&
      allCurrentCorroborated &&
      needsReconfirm &&
      (corroborationConfidence >= minCorroboration || demoCorroboration)
    ) {
      changes.push({ op: "confirm_current" });
      notes.push(
        `Fontes recentes corroboram os vínculos atuais (confiança ${corroborationConfidence}). Confirmação depende de revisão.`,
      );
    }

    const confidence = aggregateConfidence(recent.map(toSignal));
    return {
      changes,
      corroboratedEmploymentIds: [...corroborated.keys()],
      confidence,
      description: notes.join("\n"),
    };
  }
}
