import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { ImportRowAction } from "@/components/admin/import-row-action";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/session";
import type { NormalizedRow, RowIssue } from "@/lib/csv/import";
import { CONTACT_VISIBILITY_LABELS } from "@/lib/domain/labels";
import type { ContactVisibility } from "@/lib/domain/enums";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cancelImport, commitImport } from "@/app/actions/admin/imports";

export const metadata: Metadata = { title: "Prévia da importação" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ImportPreviewPage({ params }: PageProps<"/admin/importacoes/[id]">) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  await requirePermission("admin.imports");
  const supabase = await createClient();
  const { data: batch } = await supabase.from("import_batches").select("*").eq("id", id).maybeSingle();
  if (!batch) notFound();
  const { data: rows } = await supabase
    .from("import_rows")
    .select("row_number, normalized, raw, errors, warnings, duplicate_of, duplicate_reason, action, result_journalist_id")
    .eq("batch_id", id)
    .order("row_number")
    .limit(5000);

  const isPreview = batch.status === "previa";
  const report = batch.report as { created?: number; linked?: number; skipped?: number; failed?: number; parse_errors?: string[] };
  const toImport = (rows ?? []).filter((r) => r.action !== "ignorar" && (r.errors as RowIssue[]).length === 0).length;

  return (
    <>
      <PageHeader
        eyebrow="Importação"
        title={batch.file_name as string}
        description={`Criada em ${formatDateTime(batch.created_at as string)} · contatos: ${CONTACT_VISIBILITY_LABELS[batch.contact_visibility as ContactVisibility]}`}
        actions={
          isPreview ? (
            <>
              <ActionButton variant="outline" action={cancelImport.bind(null, id)}>Cancelar importação</ActionButton>
              <ActionButton action={commitImport.bind(null, id)} confirmText={`Gravar ${toImport} registro(s) na base? Eles entrarão como não verificados.`} disabled={toImport === 0}>
                Aprovar e gravar {toImport} registro(s)
              </ActionButton>
            </>
          ) : <Badge variant={batch.status === "importada" ? "success" : "outline"}>{batch.status as string}</Badge>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Linhas" value={batch.total_rows as number} />
        <StatCard label="Válidas" value={batch.valid_rows as number} tone="success" />
        <StatCard label="Com erro" value={batch.invalid_rows as number} tone={(batch.invalid_rows as number) ? "danger" : "default"} />
        <StatCard label="Possíveis duplicidades" value={batch.duplicate_rows as number} tone={(batch.duplicate_rows as number) ? "warning" : "default"} />
      </div>
      {batch.status === "importada" ? (
        <Alert variant="success" className="mb-6">
          <AlertDescription>
            Relatório: {report.created ?? 0} criado(s), {report.linked ?? 0} vinculado(s) a registros existentes, {report.skipped ?? 0} ignorado(s), {report.failed ?? 0} com falha na gravação.
          </AlertDescription>
        </Alert>
      ) : null}
      {report.parse_errors?.length ? (
        <Alert variant="warning" className="mb-6"><AlertDescription>{report.parse_errors.join(" ")}</AlertDescription></Alert>
      ) : null}
      <div className="rounded-lg border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Linha</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead>Validação</TableHead>
              <TableHead>Duplicidade</TableHead>
              <TableHead>Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).map((r) => {
              const n = r.normalized as NormalizedRow | null;
              const errors = r.errors as RowIssue[];
              const warnings = r.warnings as RowIssue[];
              const raw = r.raw as Record<string, string>;
              return (
                <TableRow key={r.row_number as number} className={errors.length ? "bg-danger-soft/40" : undefined}>
                  <TableCell className="text-xs tabular-nums">{r.row_number as number}</TableCell>
                  <TableCell className="min-w-56">
                    <p className="font-medium">{n?.full_name ?? Object.values(raw)[0] ?? "—"}</p>
                    {n ? (
                      <p className="text-xs text-muted-foreground">
                        {n.outlet_name}{n.job_title ? ` · ${n.job_title}` : ""}{n.state_code ? ` · ${n.city_name ? `${n.city_name}/` : ""}${n.state_code}` : ""}
                        {n.email ? ` · ${n.email}` : ""}{n.phone ? ` · ${n.phone}` : ""}
                      </p>
                    ) : null}
                    {r.result_journalist_id ? <Link href={`/admin/jornalistas/${r.result_journalist_id}`} className="text-xs text-info hover:underline">Ver registro</Link> : null}
                  </TableCell>
                  <TableCell className="min-w-56 text-xs">
                    {errors.length === 0 ? <Badge variant="success">Válida</Badge> : null}
                    <ul className="mt-1 space-y-0.5">
                      {errors.map((e, i) => <li key={`e${i}`} className="text-danger">✕ {e.message}</li>)}
                      {warnings.map((w, i) => <li key={`w${i}`} className="text-warning">! {w.message}</li>)}
                    </ul>
                  </TableCell>
                  <TableCell className="min-w-48 text-xs">
                    {r.duplicate_reason ? (
                      <>
                        <p>{r.duplicate_reason as string}</p>
                        {r.duplicate_of ? <Link href={`/admin/jornalistas/${r.duplicate_of}`} className="text-info hover:underline" target="_blank">Abrir existente</Link> : null}
                      </>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <ImportRowAction
                      batchId={id}
                      rowNumber={r.row_number as number}
                      action={r.action as "criar" | "vincular" | "ignorar"}
                      canLink={Boolean(r.duplicate_of)}
                      hasErrors={errors.length > 0}
                      disabled={!isPreview}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
