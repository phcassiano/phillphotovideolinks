import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/layout/auth-card";
import { SignupForm } from "@/components/forms/signup-form";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignupPage() {
  if (!isSupabaseConfigured()) redirect("/configuracao-necessaria");
  return (
    <AuthCard title="Criar conta" description="Contas de administração são concedidas apenas pelo administrador principal.">
      <SignupForm />
    </AuthCard>
  );
}
