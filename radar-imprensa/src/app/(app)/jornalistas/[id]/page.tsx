import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ExternalLink, History, Pencil, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import { AddToMailingDialog } from "@/components/journalists/add-to-mailing-dialog";
import { ContactsPanel } from "@/components/journalists/contacts-panel";
import { CorrectionDialog } from "@/components/journalists/correction-dialog";
import { EmploymentLine } from "@/components/journalists/employment-line";
import { FavoriteButton } from "@/components/journalists/favorite-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VerificationBadge } from "@/components/ui/verification-badge";
import { can, isAdminRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getFavoriteIds, getJournalistProfile } from "@/lib/data/journalists";
import { listMailings } from "@/lib/data/mailings";
import { EVIDENCE_TYPE_LABELS, PROFESSIONAL_STATUS_LABELS, VERIFICATION_DESCRIPTIONS } from "@/lib/domain/labels";
import { AppError } from "@/lib/errors";
import { formatDate, relativeDays } from "@/lib/format";

export const metadata: Metadata = { title: "Perfil do jornalista" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function JournalistProfilePage({ params }: PageProps<"/jornalistas/[id]">) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const user = await requirePermission("journalists.search");

  let profile;
  try {
    profile = await getJournalistProfile(id);
  } catch (e) {
    if (e instanceof AppError && e.kind === "rate_limited") {
      return (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>{e.message}</AlertDescription>
        </Alert>
      );
    }
    throw e;
  }
  if (!profile) notFound();

  const canManage = can(user.role, "mailings.manage");
  const admin = isAdminRole(user.role);
  const [favoriteIds, mailings] = canManage ? await Promise.all([getFavoriteIds(user.id), listMailings()]) : [new Set<string>(), []];
  const allCategories = Array.from(
    new Map(profile.current_employments.flatMap((e) => e.categories).map((c) => [c.id, c])).values(),
  );
  const stale = profile.verification_status === "desatualizado" || profile.verification_status === "nao_verificado";

  return (
    <div className="space-y-6">
      {profile.merged_into_id ? (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>
            Este registro foi unificado a outro perfil.{" "}
            <Link className="font-medium text-info hover:underline" href={`/jornalistas/${profile.merged_into_id}`}>
              Abrir perfil principal
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}
      {profile.is_hidden ? (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>Perfil oculto (oposição ou solicitação do titular). Visível apenas para administração e titular.</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4 rounded-lg border bg-surface p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          {profile.profile_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL externa autorizada pelo titular
            <img src={profile.profile_photo_url} alt={`Foto de ${profile.full_name}`} className="size-20 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div aria-hidden className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary-soft text-2xl font-semibold text-primary">
              {profile.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-primary">{profile.full_name}</h1>
            {profile.professional_name ? <p className="text-sm text-muted-foreground">Assina como {profile.professional_name}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <VerificationBadge status={profile.verification_status} />
              <Badge variant="outline">{PROFESSIONAL_STATUS_LABELS[profile.professional_status]}</Badge>
              {profile.is_claimed ? (
                <Badge variant="success">
                  <ShieldCheck aria-hidden /> Perfil gerenciado pelo titular
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 max-w-xl text-xs text-muted-foreground">{VERIFICATION_DESCRIPTIONS[profile.verification_status]}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <>
              <FavoriteButton journalistId={profile.id} initial={favoriteIds.has(profile.id)} withLabel />
              <AddToMailingDialog journalistIds={[profile.id]} mailings={mailings.filter((m) => m.owner_id === user.id).map((m) => ({ id: m.id, name: m.name }))} />
              <Button asChild variant="outline">
                <Link href={`/interacoes?jornalista=${profile.id}`}>Registrar interação</Link>
              </Button>
            </>
          ) : null}
          <CorrectionDialog journalistId={profile.id} journalistName={profile.full_name} />
          {admin ? (
            <Button asChild variant="outline">
              <Link href={`/admin/jornalistas/${profile.id}`}>
                <Pencil aria-hidden /> Editar
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {stale ? (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>
            Informações {profile.verification_status === "desatualizado" ? "desatualizadas" : "ainda não verificadas"}: confirme antes de usar
            em envios importantes.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Atuação atual</CardTitle>
              <CardDescription>Um jornalista pode ter mais de um vínculo simultâneo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.current_employments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum vínculo atual registrado (informação desconhecida).</p>
              ) : (
                profile.current_employments.map((e) => (
                  <div key={e.id} className="flex flex-col gap-2 border-b pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                    <EmploymentLine employment={e} />
                    <div className="shrink-0 text-xs text-muted-foreground sm:text-right">
                      <VerificationBadge status={e.verification_status} />
                      <p className="mt-1">Desde {formatDate(e.start_date, "data não informada")}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4" aria-hidden /> Histórico profissional
              </CardTitle>
              <CardDescription>Vínculos encerrados são preservados e nunca exibidos como atuais.</CardDescription>
            </CardHeader>
            <CardContent>
              {profile.past_employments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum vínculo anterior registrado.</p>
              ) : (
                <ol className="relative space-y-4 border-l pl-4">
                  {profile.past_employments.map((e) => (
                    <li key={e.id}>
                      <span aria-hidden className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-surface bg-muted-foreground" />
                      <EmploymentLine employment={e} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(e.start_date, "início não informado")} – {formatDate(e.end_date, "fim não informado")}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fontes públicas</CardTitle>
              <CardDescription>Evidências que sustentam as informações do perfil.</CardDescription>
            </CardHeader>
            <CardContent>
              {profile.evidence.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma fonte revisada registrada.</p>
              ) : (
                <ul className="space-y-3">
                  {profile.evidence.map((ev) => (
                    <li key={ev.id} className="rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={ev.is_demo ? "warning" : "outline"}>{EVIDENCE_TYPE_LABELS[ev.evidence_type]}</Badge>
                        {admin ? <Badge variant="outline">Revisão: {ev.review_status}</Badge> : null}
                        <span className="text-xs text-muted-foreground">
                          Observada em {formatDate(ev.observed_at ?? ev.collected_at)}
                        </span>
                      </div>
                      {ev.source_url ? (
                        <a href={ev.source_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 font-medium text-info hover:underline">
                          {ev.source_title ?? ev.source_url} <ExternalLink className="size-3" aria-hidden />
                        </a>
                      ) : (
                        <p className="mt-1 font-medium">{ev.source_title}</p>
                      )}
                      {ev.evidence_summary ? <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{ev.evidence_summary}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contatos profissionais</CardTitle>
              <CardDescription>Somente canais profissionais, com origem registrada.</CardDescription>
            </CardHeader>
            <CardContent>
              <ContactsPanel journalistId={profile.id} hasContact={profile.has_contact} privileged={admin || profile.is_owner} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-4" aria-hidden /> Atualização
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Última confirmação</dt>
                  <dd className="text-right font-medium">{formatDate(profile.last_verified_at, "Nunca")}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Última evidência</dt>
                  <dd className="text-right">{relativeDays(profile.last_evidence_at)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Última busca</dt>
                  <dd className="text-right">{relativeDays(profile.last_checked_at)}</dd>
                </div>
                {admin && profile.next_check_at ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Próxima verificação</dt>
                    <dd className="text-right">{formatDate(profile.next_check_at)}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Uma busca automática bem-sucedida não equivale a confirmação: confirmar exige revisão humana ou o próprio titular.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Editorias e temas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {allCategories.length ? allCategories.map((c) => <Badge key={c.id}>{c.name}</Badge>) : <span className="text-sm text-muted-foreground">Editorias não informadas.</span>}
              </div>
              <div className="flex flex-wrap gap-1">
                {profile.topics.length ? (
                  profile.topics.map((t) => (
                    <Badge key={t.id} variant="outline" title={t.origin === "titular" ? "Declarado pelo titular" : undefined}>
                      {t.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Temas de interesse não informados.</span>
                )}
              </div>
            </CardContent>
          </Card>

          {profile.biography ? (
            <Card>
              <CardHeader>
                <CardTitle>Sobre</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{profile.biography}</p>
              </CardContent>
            </Card>
          ) : null}

          <Button asChild variant="ghost" className="w-full">
            <Link href="/jornalistas">
              <Search aria-hidden /> Voltar à busca
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
