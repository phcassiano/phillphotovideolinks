import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Auditoria" };
const PAGE = 50;

export default async function AuditPage({ searchParams }: PageProps<"/admin/auditoria">) {
  await requirePermission("admin.audit");
  const sp = await searchParams;
  const action = typeof sp.acao === "string" ? sp.acao.trim().slice(0, 60).replace(/[%_]/g, "") : "";
  const page = Math.max(1, Number.parseInt(typeof sp.pagina === "string" ? sp.pagina : "1", 10) || 1);
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity_type, entity_id, metadata, created_at, profiles(email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (action) query = query.ilike("action", `%${action}%`);
  const { data, count } = await query;

  return (
    <>
      <PageHeader eyebrow="Administrador principal" title="Logs de auditoria" description="Registro imutável de ações administrativas, exportações, alterações de permissão e escrita em tabelas sensíveis." />
      <form method="get" className="mb-4 flex gap-2">
        <Input name="acao" defaultValue={action} placeholder="Filtrar por ação (ex.: export, merge, update)" aria-label="Filtrar por ação" className="max-w-sm" />
        <Button type="submit" variant="outline">Filtrar</Button>
      </form>
      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader><TableRow><TableHead>Quando</TableHead><TableHead>Autor</TableHead><TableHead>Ação</TableHead><TableHead>Entidade</TableHead><TableHead>Detalhes</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((l) => (
                <TableRow key={l.id as number}>
                  <TableCell className="whitespace-nowrap text-xs">{formatDateTime(l.created_at as string)}</TableCell>
                  <TableCell className="text-xs">{(l.profiles as unknown as { email: string } | null)?.email ?? (l.actor_id ? "—" : "sistema")}</TableCell>
                  <TableCell className="font-mono text-xs">{l.action as string}</TableCell>
                  <TableCell className="text-xs">{l.entity_type as string}<br /><span className="font-mono text-[10px] text-muted-foreground">{l.entity_id as string}</span></TableCell>
                  <TableCell className="max-w-80 truncate font-mono text-[11px]" title={JSON.stringify(l.metadata)}>{JSON.stringify(l.metadata)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="mt-4">
        <Pagination page={page} totalPages={Math.max(1, Math.ceil((count ?? 0) / PAGE))} hrefFor={(p) => `/admin/auditoria?${new URLSearchParams({ ...(action ? { acao: action } : {}), pagina: String(p) })}`} />
      </div>
    </>
  );
}
