import { decideReview, isSensitiveChange, type PolicyOptions } from "@/lib/confidence/policy";
import type {
  BatchReport,
  ChangeDetector,
  ClaimedJob,
  EntityResolver,
  EvidencePayload,
  JobOutcome,
  ResolvedEvidence,
  SearchProvider,
  SourceExtractor,
  VerificationRepository,
} from "./types";

export interface VerificationServiceDeps {
  provider: SearchProvider;
  extractor: SourceExtractor;
  resolver: EntityResolver;
  detector: ChangeDetector;
  repository: VerificationRepository;
  policy?: PolicyOptions;
  timeoutMs?: number;
}

export function buildQuery(name: string, outletNames: string[]): string {
  const outlet = outletNames[0] ? ` "${outletNames[0]}"` : "";
  return `"${name}" jornalista${outlet}`;
}

// Orquestra a verificação de um lote pequeno de perfis.
export class VerificationService {
  constructor(private readonly deps: VerificationServiceDeps) {}

  async runBatch(batchSize: number): Promise<BatchReport> {
    const report: BatchReport = { claimed: 0, completed: 0, skipped: 0, failed: 0, proposals: 0, evidence: 0, details: [] };
    const jobs = await this.deps.repository.claimJobs(batchSize);
    report.claimed = jobs.length;
    if (jobs.length === 0) return report;

    const knownOutlets = this.deps.provider.isConfigured ? await this.deps.repository.listKnownOutlets() : [];
    // Processamento sequencial: respeita limites de taxa dos provedores.
    for (const job of jobs) {
      const outcome = await this.runJob(job, knownOutlets);
      try {
        await this.deps.repository.recordOutcome(job.id, outcome);
      } catch (error) {
        report.failed++;
        report.details.push({
          jobId: job.id,
          journalistId: job.journalist_id,
          outcome: "falhou",
          message: `Falha ao registrar resultado: ${error instanceof Error ? error.message : String(error)}`,
        });
        continue;
      }
      if (outcome.outcome === "concluida") {
        report.completed++;
        report.evidence += outcome.evidence.length;
        if (outcome.proposal) report.proposals++;
      } else if (outcome.outcome === "ignorada") {
        report.skipped++;
      } else {
        report.failed++;
      }
      report.details.push({
        jobId: job.id,
        journalistId: job.journalist_id,
        outcome: outcome.outcome,
        message: outcome.outcome === "ignorada" ? outcome.reason : outcome.outcome === "falhou" ? outcome.error : undefined,
      });
    }
    return report;
  }

  async runJob(job: ClaimedJob, knownOutlets: Awaited<ReturnType<VerificationRepository["listKnownOutlets"]>>): Promise<JobOutcome> {
    const { provider, extractor, resolver, detector, repository } = this.deps;
    if (!provider.isConfigured) {
      return {
        outcome: "ignorada",
        provider: provider.name,
        reason: "Nenhum provedor de busca configurado (VERIFICATION_PROVIDER). Nenhuma consulta foi feita.",
      };
    }
    try {
      const snapshot = await repository.getSnapshot(job.journalist_id);
      if (!snapshot) {
        return { outcome: "ignorada", provider: provider.name, reason: "Perfil não encontrado (removido ou unificado)." };
      }
      const name = snapshot.professional_name ?? snapshot.full_name;
      const results = await provider.search(
        { journalistId: snapshot.id, text: buildQuery(name, snapshot.current_employments.map((e) => e.outlet.name)) },
        AbortSignal.timeout(this.deps.timeoutMs ?? 15_000),
      );

      const resolved: ResolvedEvidence[] = results.map((result) => {
        const extracted = extractor.extract(result, { knownOutlets });
        return { ...extracted, resolution: resolver.resolve(snapshot, extracted) };
      });
      const matched = resolved.filter((e) => e.resolution.matches);
      const detected = detector.detect(snapshot, resolved);
      const isDemo = matched.length > 0 && matched.every((e) => e.result.isDemo);

      const evidence: EvidencePayload[] = matched.map((e) => {
        const employmentClaim = e.claims.find(
          (c) => c.kind === "employment" && snapshot.current_employments.some((emp) => emp.outlet.id === c.outletId),
        );
        const employment = employmentClaim && employmentClaim.kind === "employment"
          ? snapshot.current_employments.find((emp) => emp.outlet.id === employmentClaim.outletId)
          : undefined;
        return {
          source_url: e.result.url,
          source_title: e.result.title.slice(0, 300),
          observed_at: e.result.publishedAt ?? null,
          evidence_type: e.result.isDemo ? "demonstrativa" : e.evidenceType,
          evidence_summary: `${e.result.snippet.slice(0, 1500)}\n\nCorrespondência: ${e.resolution.reasons.join("; ")}.`,
          confidence_score: e.resolution.confidence,
          related_entity_type: employment ? "employment" : "journalist",
          related_entity_id: employment ? employment.id : snapshot.id,
          is_demo: Boolean(e.result.isDemo),
        };
      });

      let proposal = null;
      if (detected.changes.length > 0) {
        const decision = decideReview(
          detected.changes,
          matched.map((e) => ({
            evidenceType: e.result.isDemo ? "demonstrativa" : e.evidenceType,
            confidence: e.resolution.confidence,
            sourceDomain: e.sourceDomain,
            isDemo: e.result.isDemo,
          })),
          this.deps.policy,
        );
        // O MVP não aplica nada automaticamente: toda proposta vai para revisão.
        proposal = {
          proposed_changes: detected.changes,
          confidence_score: detected.confidence,
          description: [detected.description, ...decision.reasons].filter(Boolean).join("\n"),
          sensitive: detected.changes.some(isSensitiveChange),
          is_demo: isDemo,
        };
      }

      return {
        outcome: "concluida",
        provider: provider.name,
        evidence,
        proposal,
        summary: {
          results: results.length,
          matched: matched.length,
          corroborated_employments: detected.corroboratedEmploymentIds.length,
          demo: isDemo,
        },
      };
    } catch (error) {
      return {
        outcome: "falhou",
        provider: provider.name,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
