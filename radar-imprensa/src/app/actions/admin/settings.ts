"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { USER_ROLES } from "@/lib/domain/enums";
import { actionError, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export async function setUserRole(userId: string, role: (typeof USER_ROLES)[number], organizationId: string | null): Promise<ActionResult> {
  await requirePermission("admin.users");
  if (!z.uuid().safeParse(userId).success || !USER_ROLES.includes(role) || (organizationId && !z.uuid().safeParse(organizationId).success)) {
    return { ok: false, error: "Dados inválidos." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", { p_user_id: userId, p_role: role, p_organization_id: organizationId });
  if (error) return actionError(error);
  revalidatePath("/admin/usuarios");
  return { ok: true, message: "Permissões atualizadas." };
}

export async function createOrganization(name: string): Promise<ActionResult> {
  await requirePermission("admin.users");
  const parsed = z.string().trim().min(2).max(160).safeParse(name);
  if (!parsed.success) return { ok: false, error: "Nome inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").insert({ name: parsed.data });
  if (error) return actionError(error);
  revalidatePath("/admin/usuarios");
  return { ok: true, message: "Organização criada." };
}

export async function updateSetting(key: string, value: number): Promise<ActionResult> {
  await requirePermission("admin.settings");
  if (!/^[a-z_]+\.[a-z_]+$/.test(key) || !Number.isInteger(value) || value < 0 || value > 100000) {
    return { ok: false, error: "Valor inválido (inteiro entre 0 e 100000)." };
  }
  const supabase = await createClient();
  const { error, count } = await supabase.from("app_settings").update({ value, updated_at: new Date().toISOString() }, { count: "exact" }).eq("key", key);
  if (error) return actionError(error);
  if (!count) return { ok: false, error: "Parâmetro desconhecido." };
  revalidatePath("/admin/configuracoes");
  return { ok: true, message: "Parâmetro salvo." };
}
