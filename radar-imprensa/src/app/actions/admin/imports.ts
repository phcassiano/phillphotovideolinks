"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import {
  buildPreview,
  mappingSchema,
  MAX_IMPORT_BYTES,
  parseCsv,
  REQUIRED_FIELDS,
  type ExistingCandidate,
} from "@/lib/csv/import";
import { actionError, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";


export async function createImportPreview(input: {
  fileName: string;
  content: string;
  mapping: Record<string, string>;
  contactVisibility: "restrito" | "assinantes";
}): Promise<ActionResult<{ batchId: string }>> {
  const user = await requirePermission("admin.imports");
  const fileName = z.string().trim().min(1).max(200).safeParse(input.fileName);
  const mapping = mappingSchema.safeParse(
    Object.fromEntries(Object.entries(input.mapping).filter(([, v]) => typeof v === "string" && v.length > 0)),
  );
  if (!fileName.success || !mapping.success) return { ok: false, error: "Arquivo ou mapeamento inválido." };
  if (new TextEncoder().encode(input.content).length > MAX_IMPORT_BYTES) return { ok: false, error: "Arquivo maior que 5 MB." };
  if (!["restrito", "assinantes"].includes(input.contactVisibility)) return { ok: false, error: "Visibilidade inválida." };
  const missing = REQUIRED_FIELDS.filter((f) => !mapping.data[f]);
  if (missing.length) return { ok: false, error: "Mapeie as colunas obrigatórias: Nome e Veículo." };

  const parsed = parseCsv(input.content);
  if (parsed.rows.length === 0) return { ok: false, error: "Nenhuma linha encontrada no arquivo." };

  const supabase = await createClient();
  const { data: categories, error: catError } = await supabase.from("editorial_categories").select("id, name").eq("active", true);
  if (catError) return actionError(catError);

  const names = parsed.rows.map((r) => r[mapping.data.full_name!] ?? "").filter(Boolean);
  const emails = mapping.data.email ? parsed.rows.map((r) => (r[mapping.data.email!] ?? "").trim().toLowerCase()).filter(Boolean) : [];
  const { data: candidates, error: candError } = await supabase.rpc("import_duplicate_candidates", { p_names: names, p_emails: emails });
  if (candError) return actionError(candError);

  const preview = buildPreview(parsed, mapping.data, categories ?? [], (candidates ?? []) as ExistingCandidate[]);

  const { data: batch, error } = await supabase
    .from("import_batches")
    .insert({
      created_by: user.id,
      file_name: fileName.data,
      column_mapping: mapping.data,
      contact_visibility: input.contactVisibility,
      total_rows: preview.total,
      valid_rows: preview.valid,
      invalid_rows: preview.invalid,
      duplicate_rows: preview.duplicates,
      report: { parse_errors: parsed.errors },
    })
    .select("id")
    .single();
  if (error) return actionError(error);

  const rows = preview.rows.map((r) => ({
    batch_id: batch.id,
    row_number: r.rowNumber,
    raw: r.raw,
    normalized: r.normalized,
    errors: r.errors,
    warnings: r.warnings,
    duplicate_of: r.duplicateOf,
    duplicate_reason: r.duplicateReason,
    action: r.action,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error: rowError } = await supabase.from("import_rows").insert(rows.slice(i, i + 500));
    if (rowError) {
      await supabase.from("import_batches").update({ status: "falhou" }).eq("id", batch.id);
      return actionError(rowError);
    }
  }
  revalidatePath("/admin/importacoes");
  return { ok: true, data: { batchId: batch.id as string } };
}

export async function setRowAction(batchId: string, rowNumber: number, action: "criar" | "vincular" | "ignorar"): Promise<ActionResult> {
  await requirePermission("admin.imports");
  if (!z.uuid().safeParse(batchId).success || !Number.isInteger(rowNumber) || !["criar", "vincular", "ignorar"].includes(action)) {
    return { ok: false, error: "Dados inválidos." };
  }
  const supabase = await createClient();
  const { data: row } = await supabase.from("import_rows").select("duplicate_of, errors").eq("batch_id", batchId).eq("row_number", rowNumber).single();
  if (action === "vincular" && !row?.duplicate_of) return { ok: false, error: "Esta linha não tem registro existente para vincular." };
  if (action !== "ignorar" && Array.isArray(row?.errors) && row.errors.length > 0) return { ok: false, error: "Linhas com erro não podem ser importadas." };
  const { error } = await supabase.from("import_rows").update({ action }).eq("batch_id", batchId).eq("row_number", rowNumber);
  if (error) return actionError(error);
  revalidatePath(`/admin/importacoes/${batchId}`);
  return { ok: true };
}

export async function commitImport(batchId: string): Promise<ActionResult> {
  await requirePermission("admin.imports");
  if (!z.uuid().safeParse(batchId).success) return { ok: false, error: "Importação inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("commit_import_batch", { p_batch_id: batchId });
  if (error) return actionError(error);
  revalidatePath(`/admin/importacoes/${batchId}`);
  revalidatePath("/admin/importacoes");
  const r = data as { created: number; linked: number; skipped: number; failed: number };
  return { ok: true, message: `Importação gravada: ${r.created} criado(s), ${r.linked} vinculado(s), ${r.skipped} ignorado(s), ${r.failed} com falha.` };
}

export async function cancelImport(batchId: string): Promise<ActionResult> {
  await requirePermission("admin.imports");
  if (!z.uuid().safeParse(batchId).success) return { ok: false, error: "Importação inválida." };
  const supabase = await createClient();
  const { error } = await supabase.from("import_batches").update({ status: "cancelada" }).eq("id", batchId).eq("status", "previa");
  if (error) return actionError(error);
  revalidatePath(`/admin/importacoes/${batchId}`);
  return { ok: true, message: "Importação cancelada. Nenhum dado foi gravado." };
}
