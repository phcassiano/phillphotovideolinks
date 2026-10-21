import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/session";
import { JOB_STATUSES, type JobStatus } from "@/lib/domain/enums";
import { JOB_STATUS_LABELS } from "@/lib/domain/labels";
import { serverEnv } from "@/lib/env.server";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { markOutdated, requeueJob, runVerificationBatch, scheduleDueVerifications } from "@/app/actions/admin/verifications";

export const metadata: Metadata = { title: "Verificações" };

const STATUS_VARIANT: Record<JobStatus, "success" | "danger" | "outline" | "info" | "warning"> = {
  agendada: "info", executando: "info", concluida: "success", falhou: "danger", ignorada: "warning", cancelada: "outline",
};

export default async function VerificationsPage({ searchParams }: PageProps<"/admin/verificacoes">) {
  await requirePermission("admin.verifications");
  const sp = await searchParams;
  const status = typeof sp.status === "string" && (JOB_STATUSES as readonly string[]).includes(sp.status) ? (sp.status as JobStatus) : undefined;
  const supabase = await createClient();
  let query = supabase
    .from("verification_jobs")
    .select("id, journalist_id, status, scheduled_at, started_at, finished_at, attempts, error_message, provider, result_summary, journalists(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) query = query.eq("status", status);
  const { data: jobs } = await query;
  const provider = serverEnv.verificationProvider;

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Verificações periódicas"
        description="Cada perfil é revisado aproximadamente a cada 30 dias, em lotes pequenos. Resultados viram evidências e propostas para revisão humana."
        actions={
          <>
            <ActionButton variant="outline" action={scheduleDueVerifications}>Agendar vencidas</ActionButton>
            <ActionButton variant="outline" action={markOutdated}>Marcar desatualizados</ActionButton>
            <ActionButton action={runVerificationBatch}>Executar lote agora</ActionButton>
          </>
        }
      />
      {provider === "none" ? (
        <Alert variant="warning" className="mb-6">
          <TriangleAlert />
          <AlertDescription>
            <strong>Nenhum provedor configurado (VERIFICATION_PROVIDER=none).</strong> As execuções são registradas como “ignoradas”
            e não atualizam a data da última busca. Configure <code>VERIFICATION_PROVIDER=demo</code> para testar com evidências
            fictícias ou <code>brave</code> com <code>BRAVE_SEARCH_API_KEY</code> para buscas reais via API oficial.
          </AlertDescription>
        </Alert>
      ) : provider === "demo" ? (
        <Alert variant="info" className="mb-6">
          <AlertDescription>
            Provedor <strong>demonstrativo</strong> ativo: as evidências geradas são fictícias, marcadas como tal, e nunca sustentam
            confirmações em produção.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader className="sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Histórico de execuções</CardTitle>
            <CardDescription>Últimas 100. Falhas são reagendadas automaticamente com espera crescente até o limite de tentativas.</CardDescription>
          </div>
          <form method="get" className="flex gap-2">
            <NativeSelect name="status" defaultValue={status ?? ""} aria-label="Filtrar por status" className="w-44">
              <option value="">Todos os status</option>
              {JOB_STATUSES.map((s) => <option key={s} value={s}>{JOB_STATUS_LABELS[s]}</option>)}
            </NativeSelect>
            <Button type="submit" variant="outline">Filtrar</Button>
          </form>
        </CardHeader>
        <CardContent>
          {(jobs ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma verificação registrada.</p> : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Jornalista</TableHead><TableHead>Status</TableHead><TableHead>Agendada</TableHead><TableHead>Concluída</TableHead><TableHead>Tentativas</TableHead><TableHead>Detalhes</TableHead><TableHead /></TableRow>
              </TableHeader>
              <TableBody>
                {(jobs ?? []).map((job) => {
                  const j = job.journalists as unknown as { full_name: string } | null;
                  const summary = job.result_summary as { evidence_count?: number; proposal_id?: string | null; demo?: boolean } | null;
                  const s = job.status as JobStatus;
                  return (
                    <TableRow key={job.id as string}>
                      <TableCell><Link href={`/admin/jornalistas/${job.journalist_id}`} className="text-info hover:underline">{j?.full_name ?? "—"}</Link></TableCell>
                      <TableCell><Badge variant={STATUS_VARIANT[s]}>{JOB_STATUS_LABELS[s]}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{formatDateTime(job.scheduled_at as string)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{formatDateTime(job.finished_at as string | null)}</TableCell>
                      <TableCell className="text-xs tabular-nums">{job.attempts as number}</TableCell>
                      <TableCell className="max-w-72 text-xs text-muted-foreground">
                        {job.provider ? <span>Provedor: {job.provider as string}. </span> : null}
                        {summary ? <span>{summary.evidence_count ?? 0} evidência(s){summary.proposal_id ? ", 1 proposta" : ""}{summary.demo ? " (demo)" : ""}. </span> : null}
                        {job.error_message ? <span className="text-danger">{job.error_message as string}</span> : null}
                      </TableCell>
                      <TableCell>
                        {["falhou", "ignorada", "cancelada", "concluida"].includes(s) ? (
                          <ActionButton size="sm" variant="ghost" action={requeueJob.bind(null, job.id as string)}>Reprocessar</ActionButton>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
