"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { actionError, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { accountSchema, claimSchema, ownContactSchema, ownEmploymentSchema, ownProfileSchema } from "@/lib/validation/forms";

const idSchema = z.uuid();

async function ownJournalistId(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; journalistId: string } | null> {
  const user = await requirePermission("profile.manageOwn");
  const supabase = await createClient();
  const { data } = await supabase.from("journalists").select("id").eq("claimed_by", user.id).maybeSingle();
  return data ? { supabase, journalistId: data.id as string } : null;
}

const NOT_CLAIMED = { ok: false as const, error: "Nenhum perfil de jornalista vinculado à sua conta." };

export async function updateAccount(input: z.input<typeof accountSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nome inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", user.id);
  if (error) return actionError(error);
  revalidatePath("/meu-perfil");
  return { ok: true, message: "Dados da conta atualizados." };
}

export async function updateOwnProfile(input: z.input<typeof ownProfileSchema>): Promise<ActionResult> {
  const own = await ownJournalistId();
  if (!own) return NOT_CLAIMED;
  const parsed = ownProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos." };
  const { error } = await own.supabase
    .from("journalists")
    .update({
      professional_name: parsed.data.professionalName ?? null,
      biography: parsed.data.biography ?? null,
      professional_status: parsed.data.professionalStatus,
    })
    .eq("id", own.journalistId);
  if (error) return actionError(error);
  revalidatePath("/meu-perfil");
  return { ok: true, message: "Perfil atualizado." };
}

export async function addOwnContact(input: z.input<typeof ownContactSchema>): Promise<ActionResult> {
  const own = await ownJournalistId();
  if (!own) return NOT_CLAIMED;
  const parsed = ownContactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Contato inválido." };
  const v = parsed.data;
  if (v.isPrimary) {
    await own.supabase.from("journalist_contacts").update({ is_primary: false }).eq("journalist_id", own.journalistId).eq("is_primary", true);
  }
  const { error } = await own.supabase.from("journalist_contacts").insert({
    journalist_id: own.journalistId,
    contact_type: v.contactType,
    contact_value: v.contactType === "email_profissional" ? v.contactValue.toLowerCase() : v.contactValue,
    visibility: v.visibility,
    professional_purpose: v.professionalPurpose ?? null,
    is_primary: v.isPrimary,
    // Contato informado pelo próprio titular: consentimento registrado.
    legal_basis: "consentimento",
    consent_recorded_at: new Date().toISOString(),
  });
  if (error) return actionError(error);
  revalidatePath("/meu-perfil");
  return { ok: true, message: "Contato adicionado." };
}

export async function setPrimaryContact(contactId: string): Promise<ActionResult> {
  const own = await ownJournalistId();
  if (!own || !idSchema.safeParse(contactId).success) return NOT_CLAIMED;
  await own.supabase.from("journalist_contacts").update({ is_primary: false }).eq("journalist_id", own.journalistId).eq("is_primary", true);
  const { error } = await own.supabase.from("journalist_contacts").update({ is_primary: true }).eq("id", contactId).eq("journalist_id", own.journalistId);
  if (error) return actionError(error);
  revalidatePath("/meu-perfil");
  return { ok: true, message: "Canal preferencial definido." };
}

export async function setContactVisibility(contactId: string, visibility: "assinantes" | "restrito"): Promise<ActionResult> {
  const own = await ownJournalistId();
  if (!own || !idSchema.safeParse(contactId).success || !["assinantes", "restrito"].includes(visibility)) return NOT_CLAIMED;
  const { error } = await own.supabase.from("journalist_contacts").update({ visibility }).eq("id", contactId).eq("journalist_id", own.journalistId);
  if (error) return actionError(error);
  revalidatePath("/meu-perfil");
  return { ok: true, message: "Visibilidade atualizada." };
}

export async function deleteOwnContact(contactId: string): Promise<ActionResult> {
  const own = await ownJournalistId();
  if (!own || !idSchema.safeParse(contactId).success) return NOT_CLAIMED;
  const { error } = await own.supabase.from("journalist_contacts").delete().eq("id", contactId).eq("journalist_id", own.journalistId);
  if (error) return actionError(error);
  revalidatePath("/meu-perfil");
  return { ok: true, message: "Contato removido." };
}

export async function addOwnEmployment(input: z.input<typeof ownEmploymentSchema>): Promise<ActionResult> {
  const own = await ownJournalistId();
  if (!own) return NOT_CLAIMED;
  const parsed = ownEmploymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Vínculo inválido." };
  const v = parsed.data;
  const { data, error } = await own.supabase
    .from("journalist_employments")
    .insert({
      journalist_id: own.journalistId,
      media_outlet_id: v.mediaOutletId,
      job_title: v.jobTitle ?? null,
      location_id: v.locationId ?? null,
      start_date: v.startDate ?? null,
      is_current: true,
    })
    .select("id")
    .single();
  if (error) return actionError(error);
  if (v.categoryIds.length) {
    const { error: catError } = await own.supabase
      .from("journalist_employment_categories")
      .insert(v.categoryIds.map((category_id) => ({ employment_id: data.id, category_id })));
    if (catError) return actionError(catError);
  }
  revalidatePath("/meu-perfil");
  return { ok: true, message: "Vínculo adicionado como declaração do titular (status provável até confirmação)." };
}

export async function endOwnEmployment(employmentId: string, endDate: string): Promise<ActionResult> {
  const own = await ownJournalistId();
  if (!own || !idSchema.safeParse(employmentId).success || !z.iso.date().safeParse(endDate).success) {
    return { ok: false, error: "Dados inválidos." };
  }
  const { error } = await own.supabase
    .from("journalist_employments")
    .update({ is_current: false, end_date: endDate })
    .eq("id", employmentId)
    .eq("journalist_id", own.journalistId);
  if (error) return actionError(error);
  revalidatePath("/meu-perfil");
  return { ok: true, message: "Vínculo encerrado e mantido no histórico." };
}

function normalizeTopic(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export async function addOwnTopic(name: string): Promise<ActionResult> {
  const own = await ownJournalistId();
  const clean = name.replace(/\s+/g, " ").trim();
  if (!own) return NOT_CLAIMED;
  if (clean.length < 2 || clean.length > 80) return { ok: false, error: "Tema deve ter entre 2 e 80 caracteres." };
  let { data: topic } = await own.supabase.from("topics").select("id").eq("normalized_name", normalizeTopic(clean)).maybeSingle();
  if (!topic) {
    const inserted = await own.supabase.from("topics").insert({ name: clean }).select("id").single();
    if (inserted.error) return actionError(inserted.error);
    topic = inserted.data;
  }
  const { error } = await own.supabase
    .from("journalist_topics")
    .upsert({ journalist_id: own.journalistId, topic_id: topic.id, origin: "titular" }, { onConflict: "journalist_id,topic_id", ignoreDuplicates: true });
  if (error) return actionError(error);
  revalidatePath("/meu-perfil");
  return { ok: true, message: "Tema adicionado." };
}

export async function removeOwnTopic(topicId: string): Promise<ActionResult> {
  const own = await ownJournalistId();
  if (!own || !idSchema.safeParse(topicId).success) return NOT_CLAIMED;
  const { error } = await own.supabase.from("journalist_topics").delete().eq("journalist_id", own.journalistId).eq("topic_id", topicId);
  if (error) return actionError(error);
  revalidatePath("/meu-perfil");
  return { ok: true, message: "Tema removido." };
}

export async function confirmOwnProfile(): Promise<ActionResult> {
  const own = await ownJournalistId();
  if (!own) return NOT_CLAIMED;
  const { error } = await own.supabase.rpc("confirm_own_profile");
  if (error) return actionError(error);
  revalidatePath("/meu-perfil");
  return { ok: true, message: "Obrigado! Seus dados atuais foram confirmados." };
}

export async function submitClaim(input: z.input<typeof claimSchema>): Promise<ActionResult> {
  await requirePermission("profile.claim");
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_profile_claim", {
    p_journalist_id: parsed.data.journalistId,
    p_method: parsed.data.method,
    p_evidence_text: parsed.data.evidenceText ?? null,
  });
  if (error) return actionError(error);
  revalidatePath("/reivindicar-perfil");
  return { ok: true, message: "Reivindicação enviada. Um administrador analisará as evidências." };
}
