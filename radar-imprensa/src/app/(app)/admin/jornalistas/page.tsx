import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { OutletForm } from "@/components/admin/journalist-subforms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VerificationBadge } from "@/components/ui/verification-badge";
import { requirePermission } from "@/lib/auth/session";
import { getLocations, locationLabel } from "@/lib/data/reference";
import { VERIFICATION_STATUSES, type VerificationStatus } from "@/lib/domain/enums";
import { VERIFICATION_LABELS } from "@/lib/domain/labels";
import { friendlyDbError } from "@/lib/errors";
import { formatDate, pluralize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cadastro de jornalistas" };
const PAGE = 30;

export default async function AdminJournalistsPage({ searchParams }: PageProps<"/admin/jornalistas">) {
  await requirePermission("admin.journalists");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 120) : "";
  const status = typeof sp.status === "string" && (VERIFICATION_STATUSES as readonly string[]).includes(sp.status) ? (sp.status as VerificationStatus) : undefined;
  const vencidos = sp.vencidos === "1";
  const page = Math.max(1, Number.parseInt(typeof sp.pagina === "string" ? sp.pagina : "1", 10) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("journalists")
    .select("id, full_name, professional_name, verification_status, last_verified_at, next_check_at, is_hidden, merged_into_id, claimed_by", { count: "exact" })
    .order("full_name")
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (q) query = query.ilike("full_name", `%${q.replace(/[%_]/g, "")}%`);
  if (status) query = query.eq("verification_status", status);
  if (vencidos) query = query.lt("next_check_at", new Date().toISOString()).is("merged_into_id", null);
  const { data, count, error } = await query;
  if (error) throw friendlyDbError(error);
  const cities = (await getLocations()).filter((l) => l.city_name).map((l) => ({ id: l.id, label: locationLabel(l) }));
  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (vencidos) params.set("vencidos", "1");
    if (p > 1) params.set("pagina", String(p));
    return `/admin/jornalistas?${params.toString()}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Cadastro de jornalistas"
        description="Gestão direta dos registros. Alterações ficam registradas no histórico e na auditoria."
        actions={<Button asChild><Link href="/admin/jornalistas/novo"><Plus aria-hidden /> Novo jornalista</Link></Button>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border bg-surface p-3">
            <Input name="q" defaultValue={q} placeholder="Nome" aria-label="Nome" className="max-w-xs" />
            <NativeSelect name="status" defaultValue={status ?? ""} aria-label="Situação" className="max-w-48">
              <option value="">Todas as situações</option>
              {VERIFICATION_STATUSES.map((s) => <option key={s} value={s}>{VERIFICATION_LABELS[s]}</option>)}
            </NativeSelect>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="vencidos" value="1" defaultChecked={vencidos} className="accent-primary" /> Revisão vencida</label>
            <Button type="submit" variant="outline"><Search aria-hidden /> Filtrar</Button>
          </form>
          <p className="text-sm text-muted-foreground">{pluralize(count ?? 0, "registro", "registros")}</p>
          {(data ?? []).length === 0 ? (
            <EmptyState title="Nenhum registro encontrado" description="Cadastre manualmente ou importe um CSV." />
          ) : (
            <div className="rounded-lg border bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Última confirmação</TableHead>
                    <TableHead>Próxima verificação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((j) => (
                    <TableRow key={j.id as string}>
                      <TableCell>
                        <Link href={`/admin/jornalistas/${j.id}`} className="font-medium text-primary hover:underline">{j.full_name as string}</Link>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {j.is_hidden ? <Badge variant="warning">Oculto</Badge> : null}
                          {j.merged_into_id ? <Badge variant="outline">Unificado</Badge> : null}
                          {j.claimed_by ? <Badge variant="success">Reivindicado</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell><VerificationBadge status={j.verification_status as VerificationStatus} /></TableCell>
                      <TableCell>{formatDate(j.last_verified_at as string | null, "Nunca")}</TableCell>
                      <TableCell>{formatDate(j.next_check_at as string | null, "Não agendada")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Pagination page={page} totalPages={Math.max(1, Math.ceil((count ?? 0) / PAGE))} hrefFor={qs} />
        </section>
        <Card className="h-fit">
          <CardHeader><CardTitle>Novo veículo</CardTitle></CardHeader>
          <CardContent><OutletForm cities={cities} /></CardContent>
        </Card>
      </div>
    </>
  );
}
