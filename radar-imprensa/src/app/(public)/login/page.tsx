import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/layout/auth-card";
import { LoginForm } from "@/components/forms/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (!isSupabaseConfigured()) redirect("/configuracao-necessaria");
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  return (
    <AuthCard title="Entrar no Radar de Imprensa" description="Use o e-mail e a senha cadastrados.">
      {params.erro === "confirmacao" ? (
        <Alert variant="danger" className="mb-4">
          <AlertDescription>O link de confirmação é inválido ou expirou. Tente entrar ou solicite um novo cadastro.</AlertDescription>
        </Alert>
      ) : null}
      <LoginForm next={next} />
    </AuthCard>
  );
}
