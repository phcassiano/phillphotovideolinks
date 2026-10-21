"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";
import { actionError, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { createVerificationService } from "@/lib/verification/factory";
import type { BatchReport } from "@/lib/verification/types";

export async function runVerificationBatch(): Promise<ActionResult<BatchReport>> {
  await requirePermission("admin.verifications");
  const supabase = await createClient();
  try {
    const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "verification.batch_size").maybeSingle();
    const batchSize = Math.min(Math.max(Number(setting?.value ?? 10) || 10, 1), 50);
    const service = createVerificationService(supabase, { provider: serverEnv.verificationProvider, braveApiKey: serverEnv.braveApiKey });
    const report = await service.runBatch(batchSize);
    revalidatePath("/admin/verificacoes");
    const message =
      report.claimed === 0
        ? "Nenhuma verificação pendente no momento."
        : `${report.claimed} processada(s): ${report.completed} concluída(s), ${report.skipped} ignorada(s), ${report.failed} com falha; ${report.proposals} proposta(s) gerada(s).`;
    return { ok: true, data: report, message };
  } catch (error) {
    return actionError(error);
  }
}

export async function scheduleDueVerifications(): Promise<ActionResult> {
  await requirePermission("admin.verifications");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("schedule_due_verifications", { p_limit: null });
  if (error) return actionError(error);
  revalidatePath("/admin/verificacoes");
  return { ok: true, message: `${data ?? 0} verificação(ões) agendada(s).` };
}

export async function requeueJob(jobId: string): Promise<ActionResult> {
  await requirePermission("admin.verifications");
  if (!z.uuid().safeParse(jobId).success) return { ok: false, error: "Registro inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("requeue_verification_job", { p_job_id: jobId });
  if (error) return actionError(error);
  revalidatePath("/admin/verificacoes");
  return { ok: true, message: "Reprocessamento agendado." };
}

export async function markOutdated(): Promise<ActionResult> {
  await requirePermission("admin.verifications");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_outdated_profiles");
  if (error) return actionError(error);
  revalidatePath("/admin/verificacoes");
  return { ok: true, message: `${data ?? 0} perfil(is) marcado(s) como desatualizado(s).` };
}
