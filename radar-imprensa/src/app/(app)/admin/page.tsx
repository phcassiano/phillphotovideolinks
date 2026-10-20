import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CircleHelp, ClipboardList, GitMerge, RefreshCw, ShieldCheck, TriangleAlert, Upload, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import type { JobStatus, VerificationStatus } from "@/lib/domain/enums";
import { JOB_STATUS_LABELS, VERIFICATION_LABELS } from "@/lib/domain/labels";
import { serverEnv } from "@/lib/env.server";
import { friendlyDbError } from "@/lib/errors";
import { formatDateTime, formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Painel administrativo" };

interface Stats {
  journalists_total: number;
  by_status: Partial<Record<VerificationStatus, number>>;
  review_overdue: number;
  hidden: number;
  pending_proposals: number;
  pending_claims: number;
  open_privacy_requests: number;
  pending_merge_suggestions: number;
  jobs_last_30d: Partial<Record<JobStatus, number>>;
  failed_jobs_30d: number;
  recent_imports: { id: string; file_name: string; status: string; created_at: string; total_rows: number; valid_rows: number }[];
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_dashboard_stats");
  if (error) throw friendlyDbError(error);
  const s = data as Stats;
  const n = (v: number | undefined) => formatNumber(v ?? 0);

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Painel de qualidade dos dados"
        actions={
          <>
            <Button asChild variant="outline"><Link href="/admin/jornalistas/novo">Novo jornalista</Link></Button>
            <Button asChild><Link href="/admin/importacoes">Importar CSV</Link></Button>
          </>
        }
      />
      {serverEnv.verificationProvider === "none" ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>
            Nenhum provedor de verificação está configurado: as verificações periódicas são agendadas, mas registradas como
            “ignoradas”, sem buscas. Veja <Link href="/admin/configuracoes" className="font-medium text-info hover:underline">Configurações</Link>.
          </p>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Jornalistas cadastrados" value={n(s.journalists_total)} icon={Users} hint={`${n(s.hidden)} oculto(s) por solicitação`} />
        <StatCard label="Perfis confirmados" value={n(s.by_status.confirmado)} icon={BadgeCheck} tone="success" />
        <StatCard label="Não verificados" value={n(s.by_status.nao_verificado)} icon={CircleHelp} />
        <StatCard label="Revisão periódica vencida" value={n(s.review_overdue)} icon={RefreshCw} tone="warning" />
        <StatCard label="Propostas pendentes" value={n(s.pending_proposals)} icon={ClipboardList} tone={s.pending_proposals ? "warning" : "default"} />
        <StatCard label="Reivindicações pendentes" value={n(s.pending_claims)} icon={ShieldCheck} />
        <StatCard label="Solicitações LGPD abertas" value={n(s.open_privacy_requests)} icon={ShieldCheck} tone={s.open_privacy_requests ? "danger" : "default"} />
        <StatCard label="Possíveis duplicidades" value={n(s.pending_merge_suggestions)} icon={GitMerge} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Situação dos perfis</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(Object.keys(VERIFICATION_LABELS) as VerificationStatus[]).map((k) => (
                <li key={k} className="flex justify-between"><span>{VERIFICATION_LABELS[k]}</span><span className="tabular-nums">{n(s.by_status[k])}</span></li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Verificações (30 dias)</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(Object.keys(JOB_STATUS_LABELS) as JobStatus[]).map((k) => (
                <li key={k} className="flex justify-between"><span>{JOB_STATUS_LABELS[k]}</span><span className="tabular-nums">{n(s.jobs_last_30d[k])}</span></li>
              ))}
            </ul>
            <Button asChild variant="link" className="mt-2 px-0"><Link href="/admin/verificacoes">Ver histórico de verificações</Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="size-4" aria-hidden /> Importações recentes</CardTitle></CardHeader>
          <CardContent>
            {s.recent_imports.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma importação.</p> : (
              <ul className="space-y-2 text-sm">
                {s.recent_imports.map((i) => (
                  <li key={i.id}>
                    <Link href={`/admin/importacoes/${i.id}`} className="font-medium text-info hover:underline">{i.file_name}</Link>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      {formatDateTime(i.created_at)} · {i.valid_rows}/{i.total_rows} válidas <Badge variant="outline">{i.status}</Badge>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
