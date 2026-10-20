"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { actionError, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { mailingNotesSchema, mailingSchema } from "@/lib/validation/forms";

const idSchema = z.uuid();

export async function createMailing(input: z.input<typeof mailingSchema>): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("mailings.manage");
  const parsed = mailingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  if (parsed.data.visibility === "organizacao" && !user.organizationId) {
    return { ok: false, error: "Sua conta não está vinculada a uma organização; crie uma lista privada." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mailing_lists")
    .insert({
      owner_id: user.id,
      organization_id: user.organizationId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      visibility: parsed.data.visibility,
    })
    .select("id")
    .single();
  if (error) return actionError(error);
  revalidatePath("/mailings");
  return { ok: true, data: { id: data.id as string }, message: "Lista criada." };
}

export async function updateMailing(id: string, input: z.input<typeof mailingSchema>): Promise<ActionResult> {
  const user = await requirePermission("mailings.manage");
  const parsed = mailingSchema.safeParse(input);
  if (!idSchema.safeParse(id).success || !parsed.success) return { ok: false, error: "Dados inválidos." };
  if (parsed.data.visibility === "organizacao" && !user.organizationId) {
    return { ok: false, error: "Sua conta não está vinculada a uma organização." };
  }
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("mailing_lists")
    .update({ name: parsed.data.name, description: parsed.data.description ?? null, visibility: parsed.data.visibility }, { count: "exact" })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) return actionError(error);
  if (!count) return { ok: false, error: "Somente o proprietário pode editar esta lista." };
  revalidatePath(`/mailings/${id}`);
  return { ok: true, message: "Lista atualizada." };
}

export async function deleteMailing(id: string): Promise<void> {
  const user = await requirePermission("mailings.manage");
  if (!idSchema.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from("mailing_lists").delete().eq("id", id).eq("owner_id", user.id);
  revalidatePath("/mailings");
  redirect("/mailings");
}

export async function addToMailing(mailingId: string, journalistIds: string[]): Promise<ActionResult<{ added: number }>> {
  const user = await requirePermission("mailings.manage");
  const ids = z.array(idSchema).min(1).max(200).safeParse(journalistIds);
  if (!idSchema.safeParse(mailingId).success || !ids.success) return { ok: false, error: "Seleção inválida (máximo de 200 por vez)." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mailing_list_members")
    .upsert(
      ids.data.map((journalist_id) => ({ mailing_list_id: mailingId, journalist_id, added_by: user.id })),
      { onConflict: "mailing_list_id,journalist_id", ignoreDuplicates: true },
    )
    .select("journalist_id");
  if (error) return actionError(error);
  revalidatePath(`/mailings/${mailingId}`);
  const added = data?.length ?? 0;
  return { ok: true, data: { added }, message: added ? `${added} jornalista(s) adicionado(s) à lista.` : "Os selecionados já estavam na lista." };
}

export async function removeFromMailing(mailingId: string, journalistId: string): Promise<ActionResult> {
  await requirePermission("mailings.manage");
  if (!idSchema.safeParse(mailingId).success || !idSchema.safeParse(journalistId).success) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.from("mailing_list_members").delete().eq("mailing_list_id", mailingId).eq("journalist_id", journalistId);
  if (error) return actionError(error);
  revalidatePath(`/mailings/${mailingId}`);
  return { ok: true, message: "Removido da lista." };
}

export async function updateMemberNotes(input: z.input<typeof mailingNotesSchema>): Promise<ActionResult> {
  await requirePermission("mailings.manage");
  const parsed = mailingNotesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nota inválida (máximo de 1000 caracteres)." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("mailing_list_members")
    .update({ notes: parsed.data.notes || null }, { count: "exact" })
    .eq("mailing_list_id", parsed.data.mailingId)
    .eq("journalist_id", parsed.data.journalistId);
  if (error) return actionError(error);
  if (!count) return { ok: false, error: "Somente o proprietário da lista pode editar notas." };
  revalidatePath(`/mailings/${parsed.data.mailingId}`);
  return { ok: true, message: "Nota salva." };
}
