import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/layout/auth-card";
import { SignupForm } from "@/components/forms/signup-form";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Criar conta" };
// Avaliado a cada requisição: a configuração do Supabase pode mudar sem novo build.
export const dynamic = "force-dynamic";

export default function SignupPage() {
  if (!isSupabaseConfigured()) redirect("/configuracao-necessaria");
  return (
    <AuthCard title="Criar conta" description="Contas de administração são concedidas apenas pelo administrador principal.">
      <SignupForm />
    </AuthCard>
  );
}
