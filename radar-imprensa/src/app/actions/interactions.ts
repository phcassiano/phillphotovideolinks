"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { actionError, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { interactionSchema } from "@/lib/validation/forms";

export async function createInteraction(input: z.input<typeof interactionSchema>): Promise<ActionResult> {
  const user = await requirePermission("interactions.manage");
  const parsed = interactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { error } = await supabase.from("journalist_interactions").insert({
    owner_id: user.id,
    journalist_id: parsed.data.journalistId,
    interaction_type: parsed.data.interactionType,
    subject: parsed.data.subject,
    notes: parsed.data.notes ?? null,
    interaction_date: parsed.data.interactionDate,
  });
  if (error) return actionError(error);
  revalidatePath("/interacoes");
  return { ok: true, message: "Interação registrada." };
}

export async function deleteInteraction(id: string): Promise<ActionResult> {
  const user = await requirePermission("interactions.manage");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Registro inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("journalist_interactions").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return actionError(error);
  revalidatePath("/interacoes");
  return { ok: true, message: "Interação excluída." };
}
