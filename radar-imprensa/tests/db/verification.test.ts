import { describe, expect, it } from "vitest";
import { EvidenceChangeDetector } from "@/lib/verification/detector";
import { SnippetExtractor } from "@/lib/verification/extractor";
import { DemoSearchProvider } from "@/lib/verification/providers/demo-provider";
import { NullSearchProvider } from "@/lib/verification/providers/null-provider";
import { ConservativeEntityResolver } from "@/lib/verification/resolver";
import { VerificationService } from "@/lib/verification/service";
import type { ClaimedJob, JobOutcome, JournalistSnapshot, KnownOutlet, SearchProvider, VerificationRepository } from "@/lib/verification/types";
import { J, setupTestDb, type Db } from "./helpers";

const db = setupTestDb();

// Repositório que usa as MESMAS RPCs do app, executadas como administrador.
class PgRepository implements VerificationRepository {
  constructor(private readonly db: Db, private readonly admin: string) {}
  async claimJobs(n: number) {
    return this.db.as<ClaimedJob>(this.admin, "select id, journalist_id, attempts from public.claim_verification_jobs($1)", [n]);
  }
  async getSnapshot(id: string) {
    const [r] = await this.db.as<{ s: JournalistSnapshot | null }>(this.admin, "select public.verification_snapshot($1) as s", [id]);
    return r!.s;
  }
  async listKnownOutlets() {
    return this.db.as<KnownOutlet>(this.admin, "select id, name, website, outlet_type from public.media_outlets");
  }
  async recordOutcome(jobId: string, o: JobOutcome) {
    await this.db.as(this.admin, "select public.record_verification_outcome($1, $2, $3, $4, $5, $6, $7)", [
      jobId, o.outcome, o.provider,
      JSON.stringify(o.outcome === "concluida" ? o.evidence : []),
      o.outcome === "concluida" && o.proposal ? JSON.stringify(o.proposal) : null,
      o.outcome === "falhou" ? o.error : o.outcome === "ignorada" ? o.reason : null,
      o.outcome === "concluida" ? JSON.stringify(o.summary) : null,
    ]);
  }
}

function makeService(provider: SearchProvider | "demo", repo: PgRepository, scenario?: "corrobora" | "mudanca" | "erro") {
  return new VerificationService({
    provider: provider === "demo" ? new DemoSearchProvider(repo, () => new Date(), () => scenario ?? "corrobora") : provider,
    extractor: new SnippetExtractor(),
    resolver: new ConservativeEntityResolver(),
    detector: new EvidenceChangeDetector(),
    repository: repo,
  });
}

describe("verificação periódica", () => {
  it("agenda apenas perfis vencidos, distribui horários e espalha a próxima revisão (~30 dias)", async () => {
    const admin = await db.createUser({ role: "admin" });
    const due = await db.sys<{ id: string }>("select id from public.journalists where merged_into_id is null and not is_hidden and (next_check_at is null or next_check_at <= now())");
    const [r] = await db.as<{ n: number }>(admin, "select public.schedule_due_verifications() as n");
    expect(r!.n).toBe(due.length);
    const jobs = await db.sys<{ scheduled_at: Date }>("select scheduled_at from public.verification_jobs");
    expect(jobs).toHaveLength(due.length);
    const next = await db.sys<{ days: number }>("select extract(epoch from next_check_at - now()) / 86400 as days from public.journalists where id = any($1)", [due.map((d) => d.id)]);
    for (const n of next) expect(Number(n.days)).toBeGreaterThan(29.9);
    for (const n of next) expect(Number(n.days)).toBeLessThan(33.1);
    // Segunda execução não duplica
    const [again] = await db.as<{ n: number }>(admin, "select public.schedule_due_verifications() as n");
    expect(again!.n).toBe(0);
  });

  it("reserva lotes pequenos sem repetir verificações já reservadas", async () => {
    const admin = await db.createUser({ role: "admin" });
    await db.sys("insert into public.verification_jobs (journalist_id, scheduled_at) select id, now() - interval '1 minute' from public.journalists where not is_hidden");
    const first = await db.as<{ id: string }>(admin, "select id from public.claim_verification_jobs(5)");
    const second = await db.as<{ id: string }>(admin, "select id from public.claim_verification_jobs(5)");
    expect(first).toHaveLength(5);
    expect(second).toHaveLength(5);
    expect(new Set([...first, ...second].map((j) => j.id)).size).toBe(10);
  });

  it("sem provedor: verificação 'ignorada' não altera a data da última busca", async () => {
    const admin = await db.createUser({ role: "admin" });
    await db.as(admin, "select public.enqueue_verification($1)", [J(3)]);
    const report = await makeService(new NullSearchProvider(), new PgRepository(db, admin)).runBatch(10);
    expect(report.skipped).toBe(1);
    const [j] = await db.sys<{ last_checked_at: Date | null }>("select last_checked_at from public.journalists where id = $1", [J(3)]);
    expect(j!.last_checked_at).toBeNull();
    const [job] = await db.sys<{ status: string; error_message: string }>("select status, error_message from public.verification_jobs where journalist_id = $1", [J(3)]);
    expect(job!.status).toBe("ignorada");
    expect(job!.error_message).toContain("Nenhum provedor");
  });

  it("execução bem-sucedida registra busca e evidência, mas NÃO confirma o perfil", async () => {
    const admin = await db.createUser({ role: "admin" });
    await db.as(admin, "select public.enqueue_verification($1)", [J(2)]);
    const report = await makeService("demo", new PgRepository(db, admin), "corrobora").runBatch(10);
    expect(report).toMatchObject({ completed: 1, evidence: 1, proposals: 1 });
    const [j] = await db.sys<{ verification_status: string; last_checked_at: Date | null; last_evidence_at: Date | null; last_verified_at: Date | null }>(
      "select verification_status, last_checked_at, last_evidence_at, last_verified_at from public.journalists where id = $1", [J(2)]);
    expect(j!.last_checked_at).not.toBeNull();
    expect(j!.last_evidence_at).not.toBeNull();
    expect(j!.last_verified_at).toBeNull();
    expect(j!.verification_status).toBe("provavel"); // confirmação não é sensível: status mantido até revisão
    const [p] = await db.sys<{ proposed_changes: { op: string }[]; is_demo: boolean; status: string }>("select proposed_changes, is_demo, status from public.change_proposals where journalist_id = $1", [J(2)]);
    expect(p).toMatchObject({ is_demo: true, status: "pendente", proposed_changes: [{ op: "confirm_current" }] });
    const evs = await db.sys<{ evidence_type: string; is_demo: boolean; review_status: string }>("select evidence_type, is_demo, review_status from public.source_evidence where journalist_id = $1 and provider = 'demonstrativo'", [J(2)]);
    expect(evs).toEqual([{ evidence_type: "demonstrativa", is_demo: true, review_status: "pendente" }]);
  });

  it("mudança detectada coloca o perfil 'em revisão' e a aprovação aplica o novo vínculo", async () => {
    const admin = await db.createUser({ role: "admin" });
    await db.as(admin, "select public.enqueue_verification($1)", [J(12)]);
    await makeService("demo", new PgRepository(db, admin), "mudanca").runBatch(10);
    const [j] = await db.sys<{ verification_status: string }>("select verification_status from public.journalists where id = $1", [J(12)]);
    expect(j!.verification_status).toBe("em_revisao");
    const [p] = await db.sys<{ id: string; prior_verification_status: string }>("select id, prior_verification_status from public.change_proposals where journalist_id = $1", [J(12)]);
    expect(p!.prior_verification_status).toBe("confirmado");
    // Seed de desenvolvimento permite aplicar demonstrativas (verification.allow_demo_apply = 1)
    await db.as(admin, "select public.review_change_proposal($1, true, null)", [p!.id]);
    const emps = await db.sys("select id from public.journalist_employments where journalist_id = $1 and is_current", [J(12)]);
    expect(emps).toHaveLength(2); // vínculo anterior preservado (uma fonte só não encerra vínculo)
    const [after] = await db.sys<{ verification_status: string }>("select verification_status from public.journalists where id = $1", [J(12)]);
    expect(after!.verification_status).toBe("confirmado");
  });

  it("falhas são reagendadas com espera crescente e marcadas como falha após o limite", async () => {
    const admin = await db.createUser({ role: "admin" });
    await db.sys("update public.app_settings set value = '2' where key = 'verification.max_attempts'");
    await db.as(admin, "select public.enqueue_verification($1)", [J(3)]);
    const repo = new PgRepository(db, admin);
    await makeService("demo", repo, "erro").runBatch(1);
    let [job] = await db.sys<{ status: string; attempts: number; error_message: string; delay: number }>(
      "select status, attempts, error_message, extract(epoch from scheduled_at - now()) as delay from public.verification_jobs where journalist_id = $1", [J(3)]);
    expect(job).toMatchObject({ status: "agendada", attempts: 1 });
    expect(Number(job!.delay)).toBeGreaterThan(25 * 60);
    expect(job!.error_message).toContain("Falha simulada");
    await db.sys("update public.verification_jobs set scheduled_at = now() - interval '1 second' where journalist_id = $1", [J(3)]);
    await makeService("demo", repo, "erro").runBatch(1);
    [job] = await db.sys("select status, attempts from public.verification_jobs where journalist_id = $1", [J(3)]);
    expect(job).toMatchObject({ status: "falhou", attempts: 2 });
    // Reprocessamento manual cria nova verificação
    const [jobRow] = await db.sys<{ id: string }>("select id from public.verification_jobs where journalist_id = $1", [J(3)]);
    await db.as(admin, "select public.requeue_verification_job($1)", [jobRow!.id]);
    const all = await db.sys<{ status: string }>("select status from public.verification_jobs where journalist_id = $1 order by created_at", [J(3)]);
    expect(all.map((a) => a.status).sort()).toEqual(["agendada", "falhou"]);
  });

  it("registros confirmados há muito tempo passam a desatualizados", async () => {
    const admin = await db.createUser({ role: "admin" });
    await db.sys("update public.journalists set verification_status = 'confirmado', last_verified_at = now() - interval '400 days' where id = $1", [J(17)]);
    await db.as(admin, "select public.mark_outdated_profiles()");
    const [j] = await db.sys<{ verification_status: string }>("select verification_status from public.journalists where id = $1", [J(17)]);
    expect(j!.verification_status).toBe("desatualizado");
  });
});
