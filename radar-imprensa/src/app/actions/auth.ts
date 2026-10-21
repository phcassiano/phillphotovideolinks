"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import type { ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, signupSchema } from "@/lib/validation/auth";
import { getPublicEnv } from "@/lib/env";

function safeNext(next: unknown): string {
  // Evita open redirect: somente caminhos internos.
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function signIn(input: z.input<typeof loginSchema>, next?: string): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Verifique e-mail e senha." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Mensagem genérica: não revela se o e-mail existe.
    return { ok: false, error: "E-mail ou senha inválidos, ou e-mail ainda não confirmado." };
  }
  redirect(safeNext(next));
}

export async function signUp(input: z.input<typeof signupSchema>): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revise os campos destacados.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { email, password, fullName, accountType, organizationName } = parsed.data;
  const origin = getPublicEnv().NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      // O papel é definido no banco (trigger): apenas assessor ou jornalista.
      data: { full_name: fullName, account_type: accountType, organization_name: organizationName || null },
    },
  });
  if (error) {
    return { ok: false, error: error.message.includes("password") ? "Senha não aceita pelo servidor de autenticação." : "Não foi possível criar a conta." };
  }
  if (data.session) redirect("/dashboard");
  return { ok: true, message: "Conta criada. Confira seu e-mail para confirmar o cadastro antes de entrar." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
