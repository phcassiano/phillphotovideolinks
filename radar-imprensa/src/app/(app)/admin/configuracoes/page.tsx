import type { Metadata } from "next";
import { CircleCheck, CircleX, KeyRound } from "lucide-react";
import { SettingRow } from "@/components/admin/setting-row";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { getIntegrationStatuses } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  await requirePermission("admin.settings");
  const supabase = await createClient();
  const { data: settings } = await supabase.from("app_settings").select("key, value, description").order("key");
  const integrations = getIntegrationStatuses();

  return (
    <>
      <PageHeader eyebrow="Administrador principal" title="Configurações" description="Integrações e parâmetros globais." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="size-4" aria-hidden /> Integrações</CardTitle>
            <CardDescription>
              Segredos são definidos apenas como variáveis de ambiente do servidor (Vercel / Supabase). Esta tela mostra somente se
              estão configurados; nenhum valor é exibido ou enviado ao navegador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {integrations.map((i) => (
                <li key={i.id} className="flex gap-3 rounded-md border p-3">
                  {i.configured ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-label="Configurado" /> : <CircleX className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-label="Não configurado" />}
                  <div>
                    <p className="text-sm font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Parâmetros globais</CardTitle>
            <CardDescription>Usados pelo banco nas verificações, limites de uso e exportações. Alterações são auditadas.</CardDescription>
          </CardHeader>
          <CardContent>
            {(settings ?? []).map((s) => (
              <SettingRow key={s.key as string} settingKey={s.key as string} value={Number(s.value)} description={s.description as string | null} />
            ))}
          </CardContent>
        </Card>
      </div>
      <Alert variant="warning" className="mt-6">
        <AlertDescription>
          <code>verification.allow_demo_apply</code> deve permanecer <strong>0</strong> em produção: com 1, propostas geradas pelo
          provedor demonstrativo (fictício) podem ser aprovadas.
        </AlertDescription>
      </Alert>
    </>
  );
}
