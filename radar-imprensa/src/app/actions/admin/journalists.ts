"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { VERIFICATION_STATUSES, EVIDENCE_TYPES } from "@/lib/domain/enums";
import { actionError, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { adminContactSchema, adminEmploymentSchema, adminJournalistSchema, outletSchema } from "@/lib/validation/forms";

const idSchema = z.uuid();

function journalistRow(v: z.output<typeof adminJournalistSchema>) {
  return {
    full_name: v.fullName,
    professional_name: v.professionalName ?? null,
    biography: v.biography ?? null,
    professional_status: v.professionalStatus,
    profile_photo_url: v.profilePhotoUrl ?? null,
    photo_authorized: v.photoAuthorized && Boolean(v.profilePhotoUrl),
  };
}

export async function createJournalist(input: z.input<typeof adminJournalistSchema>): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("admin.journalists");
  const parsed = adminJournalistSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journalists")
    .insert({ ...journalistRow(parsed.data), created_by: user.id, verification_status: "nao_verificado", next_check_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) return actionError(error);
  revalidatePath("/admin/jornalistas");
  return { ok: true, data: { id: data.id as string }, message: "Jornalista cadastrado (não verificado)." };
}

export async function updateJournalist(id: string, input: z.input<typeof adminJournalistSchema>): Promise<ActionResult> {
  await requirePermission("admin.journalists");
  const parsed = adminJournalistSchema.safeParse(input);
  if (!idSchema.safeParse(id).success || !parsed.success) return { ok: false, error: "Revise os campos." };
  const supabase = await createClient();
  const { error } = await supabase.from("journalists").update(journalistRow(parsed.data)).eq("id", id);
  if (error) return actionError(error);
  revalidatePath(`/admin/jornalistas/${id}`);
  return { ok: true, message: "Dados atualizados." };
}

export async function setJournalistHidden(id: string, hidden: boolean): Promise<ActionResult> {
  await requirePermission("admin.journalists");
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Registro inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("journalists").update({ is_hidden: hidden }).eq("id", id);
  if (error) return actionError(error);
  revalidatePath(`/admin/jornalistas/${id}`);
  return { ok: true, message: hidden ? "Perfil ocultado das buscas." : "Perfil visível novamente." };
}

export async function setVerificationStatus(id: string, status: (typeof VERIFICATION_STATUSES)[number]): Promise<ActionResult> {
  await requirePermission("admin.journalists");
  if (!idSchema.safeParse(id).success || !VERIFICATION_STATUSES.includes(status)) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  if (status === "confirmado") {
    // Confirmação manual exige ao menos uma evidência real aceita.
    const { count } = await supabase
      .from("source_evidence")
      .select("id", { count: "exact", head: true })
      .eq("journalist_id", id)
      .eq("review_status", "aceita")
      .eq("is_demo", false);
    if (!count) return { ok: false, error: "Registre e aceite ao menos uma evidência real antes de confirmar o perfil." };
  }
  const { error } = await supabase
    .from("journalists")
    .update({ verification_status: status, ...(status === "confirmado" ? { last_verified_at: new Date().toISOString() } : {}) })
    .eq("id", id);
  if (error) return actionError(error);
  revalidatePath(`/admin/jornalistas/${id}`);
  return { ok: true, message: "Situação de verificação atualizada." };
}

async function insertEvidence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  journalistId: string,
  userId: string,
  source: { url?: string; title?: string },
  entity: "employment" | "contact" | "journalist",
): Promise<string | null> {
  if (!source.url && !source.title) return null;
  const { data, error } = await supabase
    .from("source_evidence")
    .insert({
      journalist_id: journalistId,
      related_entity_type: entity,
      source_url: source.url ?? null,
      source_title: source.title ?? "Fonte informada no cadastro manual",
      evidence_type: "cadastro_manual",
      observed_at: new Date().toISOString(),
      review_status: "aceita",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function addEmployment(input: z.input<typeof adminEmploymentSchema>): Promise<ActionResult> {
  const user = await requirePermission("admin.journalists");
  const parsed = adminEmploymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const v = parsed.data;
  const supabase = await createClient();
  try {
    const sourceId = await insertEvidence(supabase, v.journalistId, user.id, { url: v.sourceUrl, title: v.sourceTitle }, "employment");
    const { data, error } = await supabase
      .from("journalist_employments")
      .insert({
        journalist_id: v.journalistId,
        media_outlet_id: v.mediaOutletId,
        job_title: v.jobTitle ?? null,
        location_id: v.locationId ?? null,
        start_date: v.startDate ?? null,
        is_current: true,
        source_id: sourceId,
        verification_status: sourceId ? "confirmado" : "nao_verificado",
        last_verified_at: sourceId ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error) return actionError(error);
    if (sourceId) await supabase.from("source_evidence").update({ related_entity_id: data.id }).eq("id", sourceId);
    if (v.categoryIds.length) {
      const { error: catError } = await supabase
        .from("journalist_employment_categories")
        .insert(v.categoryIds.map((category_id) => ({ employment_id: data.id, category_id })));
      if (catError) return actionError(catError);
    }
  } catch (error) {
    return actionError(error);
  }
  revalidatePath(`/admin/jornalistas/${v.journalistId}`);
  return { ok: true, message: "Vínculo adicionado." };
}

export async function endEmployment(journalistId: string, employmentId: string, endDate: string): Promise<ActionResult> {
  await requirePermission("admin.journalists");
  if (!idSchema.safeParse(employmentId).success || !z.iso.date().safeParse(endDate).success) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.from("journalist_employments").update({ is_current: false, end_date: endDate }).eq("id", employmentId);
  if (error) return actionError(error);
  revalidatePath(`/admin/jornalistas/${journalistId}`);
  return { ok: true, message: "Vínculo encerrado (mantido no histórico)." };
}

export async function addContact(input: z.input<typeof adminContactSchema>): Promise<ActionResult> {
  const user = await requirePermission("admin.journalists");
  const parsed = adminContactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const v = parsed.data;
  const supabase = await createClient();
  try {
    const sourceId = await insertEvidence(supabase, v.journalistId, user.id, { url: v.sourceUrl, title: v.sourceTitle }, "contact");
    const { error } = await supabase.from("journalist_contacts").insert({
      journalist_id: v.journalistId,
      contact_type: v.contactType,
      contact_value: v.contactType === "email_profissional" ? v.contactValue.toLowerCase() : v.contactValue,
      visibility: v.visibility,
      professional_purpose: v.professionalPurpose ?? null,
      source_id: sourceId,
      verification_status: sourceId ? "confirmado" : "nao_verificado",
      last_verified_at: sourceId ? new Date().toISOString() : null,
    });
    if (error) return actionError(error);
  } catch (error) {
    return actionError(error);
  }
  revalidatePath(`/admin/jornalistas/${v.journalistId}`);
  return { ok: true, message: "Contato adicionado." };
}

export async function updateContactVisibility(journalistId: string, contactId: string, visibility: "assinantes" | "restrito" | "oculto"): Promise<ActionResult> {
  await requirePermission("admin.journalists");
  if (!idSchema.safeParse(contactId).success || !["assinantes", "restrito", "oculto"].includes(visibility)) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  if (visibility === "assinantes") {
    const { data } = await supabase.from("journalist_contacts").select("source_id, legal_basis").eq("id", contactId).single();
    if (!data?.source_id && data?.legal_basis !== "consentimento") {
      return { ok: false, error: "Contatos sem fonte registrada não podem ficar visíveis aos usuários." };
    }
  }
  const { error } = await supabase.from("journalist_contacts").update({ visibility }).eq("id", contactId);
  if (error) return actionError(error);
  revalidatePath(`/admin/jornalistas/${journalistId}`);
  return { ok: true, message: "Visibilidade atualizada." };
}

export async function deleteContact(journalistId: string, contactId: string): Promise<ActionResult> {
  await requirePermission("admin.journalists");
  if (!idSchema.safeParse(contactId).success) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.from("journalist_contacts").delete().eq("id", contactId);
  if (error) return actionError(error);
  revalidatePath(`/admin/jornalistas/${journalistId}`);
  return { ok: true, message: "Contato removido." };
}

const evidenceSchema = z.object({
  journalistId: z.uuid(),
  sourceUrl: z.url({ protocol: /^https?$/ }).optional().or(z.literal("").transform(() => undefined)),
  sourceTitle: z.string().trim().min(3).max(300),
  evidenceType: z.enum(EVIDENCE_TYPES).exclude(["demonstrativa", "busca_automatizada"]),
  summary: z.string().trim().max(2000).optional(),
  observedAt: z.iso.date().optional().or(z.literal("").transform(() => undefined)),
});

export async function addEvidence(input: z.input<typeof evidenceSchema>): Promise<ActionResult> {
  const user = await requirePermission("admin.journalists");
  const parsed = evidenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("source_evidence").insert({
    journalist_id: v.journalistId,
    related_entity_type: "journalist",
    related_entity_id: v.journalistId,
    source_url: v.sourceUrl ?? null,
    source_title: v.sourceTitle,
    evidence_type: v.evidenceType,
    evidence_summary: v.summary || null,
    observed_at: v.observedAt ?? new Date().toISOString(),
    review_status: "aceita",
    created_by: user.id,
  });
  if (error) return actionError(error);
  await supabase.from("journalists").update({ last_evidence_at: new Date().toISOString() }).eq("id", v.journalistId);
  revalidatePath(`/admin/jornalistas/${v.journalistId}`);
  return { ok: true, message: "Evidência registrada." };
}

export async function reviewEvidence(journalistId: string, evidenceId: string, status: "aceita" | "rejeitada"): Promise<ActionResult> {
  await requirePermission("admin.reviews");
  if (!idSchema.safeParse(evidenceId).success) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.from("source_evidence").update({ review_status: status }).eq("id", evidenceId).eq("is_demo", false);
  if (error) return actionError(error);
  revalidatePath(`/admin/jornalistas/${journalistId}`);
  return { ok: true, message: status === "aceita" ? "Evidência aceita." : "Evidência rejeitada." };
}

export async function enqueueVerification(journalistId: string): Promise<ActionResult> {
  await requirePermission("admin.verifications");
  if (!idSchema.safeParse(journalistId).success) return { ok: false, error: "Registro inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("enqueue_verification", { p_journalist_id: journalistId });
  if (error) return actionError(error);
  revalidatePath("/admin/verificacoes");
  return { ok: true, message: "Verificação agendada para a próxima execução." };
}

export async function createOutlet(input: z.input<typeof outletSchema>): Promise<ActionResult<{ id: string }>> {
  await requirePermission("admin.journalists");
  const parsed = outletSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_outlets")
    .insert({
      name: parsed.data.name,
      website: parsed.data.website ?? null,
      outlet_type: parsed.data.outletType,
      headquarters_city_id: parsed.data.headquartersCityId ?? null,
    })
    .select("id")
    .single();
  if (error) return actionError(error);
  revalidatePath("/admin/jornalistas");
  return { ok: true, data: { id: data.id as string }, message: "Veículo cadastrado." };
}

export async function deleteJournalist(id: string): Promise<void> {
  await requirePermission("admin.journalists");
  if (!idSchema.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from("journalists").delete().eq("id", id);
  revalidatePath("/admin/jornalistas");
  redirect("/admin/jornalistas");
}
