import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { PautaMatcher } from "@/components/journalists/pauta-matcher";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";

export const metadata: Metadata = { title: "Encontrar jornalistas para minha pauta" };

export default async function PautasPage() {
  await requirePermission("journalists.search");
  return (
    <>
      <PageHeader eyebrow="Fase 2 · Beta" title="Encontrar jornalistas para minha pauta" description="Recomendações baseadas apenas em jornalistas cadastrados, com critérios transparentes." />
      {!serverEnv.featurePautaMatching ? (
        <EmptyState
          icon={Sparkles}
          title="Funcionalidade desabilitada no MVP"
          description="A arquitetura está pronta (interpretação, cruzamento e ranking explicável), mas a funcionalidade só é ativada com FEATURE_PAUTA_MATCHING=true."
        />
      ) : (
        <>
          <Alert variant="info" className="mb-6">
            <AlertDescription>
              Interpretação por regras (sem IA externa). Nenhum jornalista ou contato é gerado: o sistema apenas reordena candidatos do
              banco e explica cada motivo.
            </AlertDescription>
          </Alert>
          <PautaMatcher />
        </>
      )}
    </>
  );
}
