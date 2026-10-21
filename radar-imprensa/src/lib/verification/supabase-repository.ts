import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyDbError } from "@/lib/errors";
import type { ClaimedJob, JobOutcome, JournalistSnapshot, KnownOutlet, VerificationRepository } from "./types";

// Persistência via RPCs do banco. Requer cliente com papel administrativo
// (sessão de administrador) ou service_role (processamento agendado).
export class SupabaseVerificationRepository implements VerificationRepository {
  private outlets: KnownOutlet[] | null = null;

  constructor(private readonly db: SupabaseClient) {}

  async claimJobs(batchSize: number): Promise<ClaimedJob[]> {
    const { data, error } = await this.db.rpc("claim_verification_jobs", { p_batch_size: batchSize });
    if (error) throw friendlyDbError(error);
    return (data ?? []) as ClaimedJob[];
  }

  async getSnapshot(journalistId: string): Promise<JournalistSnapshot | null> {
    const { data, error } = await this.db.rpc("verification_snapshot", { p_journalist_id: journalistId });
    if (error) throw friendlyDbError(error);
    return (data as JournalistSnapshot | null) ?? null;
  }

  async listKnownOutlets(): Promise<KnownOutlet[]> {
    if (this.outlets) return this.outlets;
    const { data, error } = await this.db
      .from("media_outlets")
      .select("id, name, website, outlet_type")
      .eq("active", true)
      .limit(5000);
    if (error) throw friendlyDbError(error);
    this.outlets = (data ?? []) as KnownOutlet[];
    return this.outlets;
  }

  async recordOutcome(jobId: string, outcome: JobOutcome): Promise<void> {
    const args =
      outcome.outcome === "concluida"
        ? {
            p_job_id: jobId,
            p_outcome: "concluida",
            p_provider: outcome.provider,
            p_evidence: outcome.evidence,
            p_proposal: outcome.proposal,
            p_error: null,
            p_summary: outcome.summary,
          }
        : {
            p_job_id: jobId,
            p_outcome: outcome.outcome,
            p_provider: outcome.provider,
            p_evidence: [],
            p_proposal: null,
            p_error: outcome.outcome === "falhou" ? outcome.error : outcome.reason,
            p_summary: null,
          };
    const { error } = await this.db.rpc("record_verification_outcome", args);
    if (error) throw friendlyDbError(error);
  }
}
