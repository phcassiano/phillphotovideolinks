"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, requireUser } from "@/lib/auth/session";
import type { ContactItem } from "@/lib/domain/types";
import { actionError, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { correctionSchema } from "@/lib/validation/forms";

const idSchema = z.uuid();

export async function toggleFavorite(journalistId: string, favorite: boolean): Promise<ActionResult> {
  const user = await requirePermission("favorites.manage");
  if (!idSchema.safeParse(journalistId).success) return { ok: false, error: "Perfil inválido." };
  const supabase = await createClient();
  const { error } = favorite
    ? await supabase.from("favorites").upsert({ user_id: user.id, journalist_id: journalistId }, { onConflict: "user_id,journalist_id", ignoreDuplicates: true })
    : await supabase.from("favorites").delete().eq("user_id", user.id).eq("journalist_id", journalistId);
  if (error) return actionError(error);
  revalidatePath("/favoritos");
  return { ok: true, message: favorite ? "Adicionado aos favoritos." : "Removido dos favoritos." };
}

// Contatos são revelados sob demanda: cada consulta conta no limite diário.
export async function revealContacts(journalistId: string): Promise<ActionResult<ContactItem[]>> {
  await requireUser();
  if (!idSchema.safeParse(journalistId).success) return { ok: false, error: "Perfil inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_journalist_contacts", { p_journalist_id: journalistId });
  if (error) return actionError(error);
  return { ok: true, data: (data ?? []) as ContactItem[] };
}

export async function suggestCorrection(input: z.input<typeof correctionSchema>): Promise<ActionResult> {
  await requirePermission("corrections.suggest");
  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_correction", {
    p_journalist_id: parsed.data.journalistId,
    p_description: parsed.data.description,
    p_source_url: parsed.data.sourceUrl ?? null,
  });
  if (error) return actionError(error);
  return { ok: true, message: "Sugestão enviada para revisão. Obrigado por ajudar a manter os dados corretos." };
}
