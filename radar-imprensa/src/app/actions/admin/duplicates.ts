"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { actionError, type ActionResult } from "@/lib/errors";
import { assessDuplicatePair } from "@/lib/identity/duplicates";
import { createClient } from "@/lib/supabase/server";

interface CandidatePair {
  journalist_a_id: string;
  journalist_b_id: string;
  name_a: string;
  name_b: string;
  professional_name_a: string | null;
  professional_name_b: string | null;
  shared_outlets: number;
  shared_identifiers: number;
  conflicting_identifiers: number;
  shared_bylines: number;
  existing_status: string | null;
}

// Detecta possíveis duplicidades e cria SUGESTÕES. Nunca unifica automaticamente.
export async function detectDuplicates(): Promise<ActionResult<{ created: number; evaluated: number }>> {
  await requirePermission("admin.reviews");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_candidate_pairs", { p_min_similarity: 0.45, p_limit: 500 });
  if (error) return actionError(error);
  const pairs = (data ?? []) as CandidatePair[];
  const rows = pairs
    .filter((p) => !p.existing_status)
    .map((p) => ({
      pair: p,
      assessment: assessDuplicatePair({
        nameA: p.name_a,
        nameB: p.name_b,
        professionalNameA: p.professional_name_a,
        professionalNameB: p.professional_name_b,
        sharedOutlets: p.shared_outlets,
        sharedIdentifiers: p.shared_identifiers,
        conflictingIdentifiers: p.conflicting_identifiers,
        sharedBylines: p.shared_bylines,
      }),
    }))
    .filter((r) => r.assessment.shouldSuggest)
    .map((r) => ({
      journalist_a_id: r.pair.journalist_a_id,
      journalist_b_id: r.pair.journalist_b_id,
      score: r.assessment.score,
      reasons: r.assessment.reasons,
    }));
  if (rows.length) {
    const { error: insertError } = await supabase
      .from("journalist_merge_suggestions")
      .upsert(rows, { onConflict: "journalist_a_id,journalist_b_id", ignoreDuplicates: true });
    if (insertError) return actionError(insertError);
  }
  revalidatePath("/admin/duplicidades");
  return {
    ok: true,
    data: { created: rows.length, evaluated: pairs.length },
    message: `${pairs.length} par(es) avaliado(s); ${rows.length} nova(s) sugestão(ões) para revisão.`,
  };
}

export async function mergeFromSuggestion(suggestionId: string, survivorId: string, mergedId: string): Promise<ActionResult> {
  await requirePermission("admin.reviews");
  if (![suggestionId, survivorId, mergedId].every((v) => z.uuid().safeParse(v).success)) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("merge_journalists", { p_survivor_id: survivorId, p_merged_id: mergedId, p_suggestion_id: suggestionId });
  if (error) return actionError(error);
  revalidatePath("/admin/duplicidades");
  return { ok: true, message: "Registros unificados. A operação pode ser desfeita." };
}

export async function rejectSuggestion(suggestionId: string): Promise<ActionResult> {
  const user = await requirePermission("admin.reviews");
  if (!z.uuid().safeParse(suggestionId).success) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("journalist_merge_suggestions")
    .update({ status: "rejeitada", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", suggestionId);
  if (error) return actionError(error);
  revalidatePath("/admin/duplicidades");
  return { ok: true, message: "Sugestão descartada: registros mantidos separados." };
}

export async function unmerge(mergeId: string): Promise<ActionResult> {
  await requirePermission("admin.reviews");
  if (!z.uuid().safeParse(mergeId).success) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("unmerge_journalists", { p_merge_id: mergeId });
  if (error) return actionError(error);
  revalidatePath("/admin/duplicidades");
  return { ok: true, message: "Unificação desfeita: os registros voltaram a ser separados." };
}
