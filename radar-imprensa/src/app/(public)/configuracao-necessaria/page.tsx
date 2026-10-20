import type { Metadata } from "next";
import { Database } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Configuração necessária" };

export default function SetupRequiredPage() {
  const configured = isSupabaseConfigured();
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-xl border bg-surface p-8">
        <Database className="size-8 text-warning" aria-hidden />
        <h1 className="mt-3 text-2xl font-semibold text-primary">
          {configured ? "Supabase configurado" : "Conecte o Supabase para usar o Radar de Imprensa"}
        </h1>
        {configured ? (
          <p className="mt-2 text-sm text-muted-foreground">As variáveis públicas do Supabase estão presentes. Volte à página inicial.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              O aplicativo depende de um projeto Supabase (PostgreSQL, Auth e RLS). Sem ele, as áreas autenticadas ficam
              indisponíveis; nenhum dado de demonstração é simulado na interface.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
              <li>Crie um projeto em supabase.com (plano gratuito) ou rode <code>supabase start</code> localmente.</li>
              <li>Aplique as migrations de <code>supabase/migrations</code> (<code>supabase db push</code>).</li>
              <li>
                Defina <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> no <code>.env.local</code> ou na
                Vercel.
              </li>
              <li>Reinicie o servidor. Detalhes no README e em <code>docs/DEPLOY.md</code>.</li>
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
