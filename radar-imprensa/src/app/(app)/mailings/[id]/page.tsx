import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Search, Users } from "lucide-react";
import { JournalistCardRow } from "@/components/journalists/journalist-card-row";
import { DeleteMailingButton } from "@/components/mailings/delete-mailing-button";
import { MailingForm } from "@/components/mailings/mailing-form";
import { MemberNotes, RemoveMemberButton } from "@/components/mailings/member-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { getJournalistCards } from "@/lib/data/journalists";
import { getMailing } from "@/lib/data/mailings";
import { MAILING_VISIBILITY_LABELS } from "@/lib/domain/labels";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "Mailing" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MailingDetailPage({ params, searchParams }: PageProps<"/mailings/[id]">) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const user = await requirePermission("mailings.manage");
  const mailing = await getMailing(id);
  if (!mailing) notFound();
  const sp = await searchParams;

  const owner = mailing.owner_id === user.id;
  const cards = await getJournalistCards(mailing.members.map((m) => m.journalist_id));
  const notesById = new Map(mailing.members.map((m) => [m.journalist_id, m.notes]));

  return (
    <>
      <PageHeader
        eyebrow="Mailing"
        title={mailing.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {mailing.description ? <span>{mailing.description}</span> : null}
            <Badge variant={mailing.visibility === "organizacao" ? "info" : "outline"}>
              {mailing.visibility === "organizacao" ? <Users aria-hidden /> : null}
              {MAILING_VISIBILITY_LABELS[mailing.visibility]}
            </Badge>
            <span>{pluralize(cards.length, "jornalista", "jornalistas")}</span>
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/jornalistas">
                <Search aria-hidden /> Adicionar pela busca
              </Link>
            </Button>
            <Button asChild disabled={cards.length === 0}>
              <a href={`/mailings/${mailing.id}/exportar`} download>
                <Download aria-hidden /> Exportar CSV
              </a>
            </Button>
          </>
        }
      />
      {sp.erro ? (
        <p role="alert" className="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {String(sp.erro)}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section aria-label="Jornalistas da lista">
          {cards.length === 0 ? (
            <EmptyState
              title="Lista vazia"
              description="Na busca de jornalistas, selecione resultados e use “Adicionar a mailing”."
              action={
                <Button asChild>
                  <Link href="/jornalistas">Buscar jornalistas</Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {cards.map((card) => (
                <li key={card.id}>
                  <JournalistCardRow card={card}>
                    <div className="flex flex-col items-end gap-2">
                      <MemberNotes mailingId={mailing.id} journalistId={card.id} initial={notesById.get(card.id) ?? null} editable={owner} />
                      {owner ? <RemoveMemberButton mailingId={mailing.id} journalistId={card.id} /> : null}
                    </div>
                  </JournalistCardRow>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="space-y-4">
          {owner ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Editar lista</CardTitle>
                </CardHeader>
                <CardContent>
                  <MailingForm
                    mailingId={mailing.id}
                    hasOrganization={Boolean(user.organizationId)}
                    defaults={{ name: mailing.name, description: mailing.description ?? "", visibility: mailing.visibility }}
                  />
                </CardContent>
              </Card>
              <DeleteMailingButton mailingId={mailing.id} name={mailing.name} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Lista compartilhada pela sua organização (somente leitura).</p>
          )}
          <p className="text-xs text-muted-foreground">
            A exportação inclui apenas contatos com visibilidade autorizada, é limitada por hora e fica registrada em auditoria.
          </p>
        </aside>
      </div>
    </>
  );
}
