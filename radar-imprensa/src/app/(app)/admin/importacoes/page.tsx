import type { Metadata } from "next";
import Link from "next/link";
import { ImportUploader } from "@/components/admin/import-uploader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Importações" };

export default async function ImportsPage() {
  await requirePermission("admin.imports");
  const supabase = await createClient();
  const { data: batches } = await supabase
    .from("import_batches")
    .select("id, file_name, status, total_rows, valid_rows, invalid_rows, duplicate_rows, created_at, report")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <>
      <PageHeader eyebrow="Administração" title="Importação por CSV" description="Fluxo: envio → mapeamento → prévia com validação e deduplicação → aprovação → gravação." />
      <Alert variant="info" className="mb-6">
        <AlertDescription>
          Registros importados entram sempre como <strong>não verificados</strong>; a coluna “Data da verificação” é guardada apenas
          como data da fonte. Use somente dados profissionais obtidos legitimamente e informe a fonte.
        </AlertDescription>
      </Alert>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Nova importação</CardTitle></CardHeader>
          <CardContent><ImportUploader /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
          <CardContent>
            {(batches ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma importação.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Arquivo</TableHead><TableHead>Status</TableHead><TableHead>Linhas</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(batches ?? []).map((b) => (
                    <TableRow key={b.id as string}>
                      <TableCell>
                        <Link href={`/admin/importacoes/${b.id}`} className="font-medium text-info hover:underline">{b.file_name as string}</Link>
                        <p className="text-xs text-muted-foreground">{formatDateTime(b.created_at as string)}</p>
                      </TableCell>
                      <TableCell><Badge variant={b.status === "importada" ? "success" : b.status === "previa" ? "info" : "outline"}>{b.status as string}</Badge></TableCell>
                      <TableCell className="text-xs">{b.valid_rows as number} válidas · {b.invalid_rows as number} com erro · {b.duplicate_rows as number} duplicadas</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
