import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Users } from "lucide-react";
import { MailingForm } from "@/components/mailings/mailing-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { listMailings } from "@/lib/data/mailings";
import { formatDate, pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "Mailings" };

export default async function MailingsPage() {
  const user = await requirePermission("mailings.manage");
  const mailings = await listMailings();

  return (
    <>
      <PageHeader title="Mailings" description="Listas de jornalistas por pauta. Exportações incluem apenas contatos autorizados." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section aria-label="Suas listas">
          {mailings.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="Nenhuma lista criada"
              description='Crie listas como "Política — Brasília" ou "Imprensa — Piauí" e adicione jornalistas pela busca.'
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {mailings.map((m) => (
                <li key={m.id}>
                  <Link href={`/mailings/${m.id}`} className="block h-full rounded-lg border bg-surface p-4 shadow-xs transition hover:border-primary/40 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold text-primary">{m.name}</h2>
                      {m.visibility === "organizacao" ? (
                        <Badge variant="info">
                          <Users aria-hidden /> Organização
                        </Badge>
                      ) : (
                        <Badge variant="outline">Privada</Badge>
                      )}
                    </div>
                    {m.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.description}</p> : null}
                    <p className="mt-3 text-xs text-muted-foreground">
                      {pluralize(m.member_count, "jornalista", "jornalistas")} · atualizada em {formatDate(m.updated_at)}
                      {m.owner_id !== user.id ? " · compartilhada" : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Nova lista</CardTitle>
            <CardDescription>Listas privadas são visíveis só para você.</CardDescription>
          </CardHeader>
          <CardContent>
            <MailingForm hasOrganization={Boolean(user.organizationId)} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
