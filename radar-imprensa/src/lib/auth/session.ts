import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import type { UserRole } from "@/lib/domain/enums";
import { createClient } from "@/lib/supabase/server";
import { can, type Permission } from "./permissions";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  organizationId: string | null;
  organizationName: string | null;
}

// Lê e valida a sessão uma vez por requisição.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, organization_id, organizations(name)")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;
  const org = profile.organizations as { name: string } | { name: string }[] | null;
  return {
    id: profile.id as string,
    email: profile.email as string,
    fullName: (profile.full_name as string) || (profile.email as string),
    role: profile.role as UserRole,
    organizationId: (profile.organization_id as string | null) ?? null,
    organizationName: Array.isArray(org) ? (org[0]?.name ?? null) : (org?.name ?? null),
  };
});

export async function requireUser(): Promise<SessionUser> {
  if (!isSupabaseConfigured()) redirect("/configuracao-necessaria");
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/dashboard?acesso=negado");
  return user;
}
