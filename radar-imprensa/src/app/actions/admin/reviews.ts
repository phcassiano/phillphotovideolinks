"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { PRIVACY_REQUEST_STATUSES } from "@/lib/domain/enums";
import { actionError, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.uuid();
const notesSchema = z.string().trim().max(2000).optional();

export async function reviewProposal(id: string, approve: boolean, notes?: string): Promise<ActionResult> {
  await requirePermission("admin.reviews");
  if (!idSchema.safeParse(id).success || !notesSchema.safeParse(notes).success) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_change_proposal", { p_proposal_id: id, p_approve: approve, p_notes: notes ?? null });
  if (error) return actionError(error);
  revalidatePath("/admin/revisoes");
  revalidatePath("/admin");
  return { ok: true, message: approve ? "Proposta aprovada e aplicada." : "Proposta rejeitada." };
}

export async function reviewClaim(id: string, approve: boolean, notes?: string): Promise<ActionResult> {
  await requirePermission("admin.reviews");
  if (!idSchema.safeParse(id).success || !notesSchema.safeParse(notes).success) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_profile_claim", { p_claim_id: id, p_approve: approve, p_notes: notes ?? null });
  if (error) return actionError(error);
  revalidatePath("/admin/revisoes");
  return { ok: true, message: approve ? "Perfil vinculado ao jornalista." : "Reivindicação recusada." };
}

export async function resolvePrivacyRequest(id: string, status: (typeof PRIVACY_REQUEST_STATUSES)[number], notes?: string): Promise<ActionResult> {
  await requirePermission("admin.reviews");
  if (!idSchema.safeParse(id).success || !PRIVACY_REQUEST_STATUSES.includes(status)) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_privacy_request", { p_request_id: id, p_status: status, p_notes: notes ?? null });
  if (error) return actionError(error);
  revalidatePath("/admin/revisoes");
  return { ok: true, message: "Solicitação atualizada." };
}
