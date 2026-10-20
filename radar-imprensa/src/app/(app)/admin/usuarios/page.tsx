import type { Metadata } from "next";
import { OrganizationForm } from "@/components/admin/organization-form";
import { UserRoleForm } from "@/components/admin/user-role-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/session";
import type { UserRole } from "@/lib/domain/enums";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/usuarios">) {
  const me = await requirePermission("admin.users");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 120).replace(/[%_,()]/g, "") : "";
  const supabase = await createClient();
  let query = supabase.from("profiles").select("id, full_name, email, role, organization_id, created_at").order("created_at", { ascending: false }).limit(200);
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  const [{ data: users }, { data: orgs }] = await Promise.all([query, supabase.from("organizations").select("id, name").order("name")]);

  return (
    <>
      <PageHeader eyebrow="Administrador principal" title="Usuários e permissões" description="Alterações de papel e organização são auditadas. Papéis administrativos só podem ser concedidos aqui." />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Contas</CardTitle>
            <form method="get" className="flex gap-2">
              <Input name="q" defaultValue={q} placeholder="Nome ou e-mail" aria-label="Buscar usuário" className="w-56" />
              <Button type="submit" variant="outline">Buscar</Button>
            </form>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Desde</TableHead><TableHead>Papel e organização</TableHead></TableRow></TableHeader>
              <TableBody>
                {(users ?? []).map((u) => (
                  <TableRow key={u.id as string}>
                    <TableCell>
                      <p className="font-medium">{(u.full_name as string) || "—"}{u.id === me.id ? " (você)" : ""}</p>
                      <p className="text-xs text-muted-foreground">{u.email as string}</p>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(u.created_at as string)}</TableCell>
                    <TableCell>
                      <UserRoleForm userId={u.id as string} role={u.role as UserRole} organizationId={u.organization_id as string | null} organizations={(orgs ?? []).map((o) => ({ id: o.id as string, name: o.name as string }))} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Organizações</CardTitle>
            <CardDescription>Membros de uma organização podem compartilhar mailings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <OrganizationForm />
            <ul className="space-y-1 text-sm">{(orgs ?? []).map((o) => <li key={o.id as string}>{o.name as string}</li>)}</ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
