import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button";
import { JournalistForm } from "@/components/admin/journalist-form";
import { AdminContactForm, AdminEmploymentForm, AdminEvidenceForm, EndEmploymentInline } from "@/components/admin/journalist-subforms";
import { EmploymentLine } from "@/components/journalists/employment-line";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VerificationBadge } from "@/components/ui/verification-badge";
import { requirePermission } from "@/lib/auth/session";
import { getCategories, getLocations, getOutlets, groupCategories, locationLabel } from "@/lib/data/reference";
import type { ContactType, ContactVisibility, EvidenceType, ProfessionalStatus, VerificationStatus } from "@/lib/domain/enums";
import { VERIFICATION_STATUSES } from "@/lib/domain/enums";
import type { EmploymentSummary } from "@/lib/domain/types";
import { CONTACT_TYPE_LABELS, CONTACT_VISIBILITY_LABELS, EVIDENCE_TYPE_LABELS, VERIFICATION_LABELS } from "@/lib/domain/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  deleteContact, deleteJournalist, enqueueVerification, reviewEvidence, setJournalistHidden, setVerificationStatus, updateContactVisibility,
} from "@/app/actions/admin/journalists";

export const metadata: Metadata = { title: "Editar jornalista" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminJournalistPage({ params }: PageProps<"/admin/jornalistas/[id]">) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  await requirePermission("admin.journalists");
  const supabase = await createClient();
  const { data: j } = await supabase.from("journalists").select("*").eq("id", id).maybeSingle();
  if (!j) notFound();

  const [snapshot, contacts, evidence, history, jobs, outlets, locations, categories] = await Promise.all([
    supabase.rpc("verification_snapshot", { p_journalist_id: id }),
    supabase.from("journalist_contacts").select("id, contact_type, contact_value, visibility, verification_status, is_primary, source_id, last_verified_at").eq("journalist_id", id).order("created_at"),
    supabase.from("source_evidence").select("id, source_url, source_title, evidence_type, review_status, is_demo, observed_at, collected_at, confidence_score").eq("journalist_id", id).order("collected_at", { ascending: false }).limit(50),
    supabase.from("journalist_change_history").select("id, entity_type, field_name, old_value, new_value, change_source, changed_at").eq("journalist_id", id).order("changed_at", { ascending: false }).limit(50),
    supabase.from("verification_jobs").select("id, status, scheduled_at, finished_at, attempts, error_message, provider").eq("journalist_id", id).order("created_at", { ascending: false }).limit(10),
    getOutlets(),
    getLocations(),
    getCategories(),
  ]);
  const snap = snapshot.data as { current_employments: EmploymentSummary[]; past_employments: EmploymentSummary[] } | null;
  const categoryOptions = groupCategories(categories).flatMap((g) => [
    { id: g.parent.id, label: g.parent.name },
    ...g.children.map((c) => ({ id: c.id, label: `${g.parent.name} › ${c.name}` })),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Administração · Jornalista"
        title={j.full_name as string}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <VerificationBadge status={j.verification_status as VerificationStatus} />
            {j.is_hidden ? <Badge variant="warning">Oculto</Badge> : null}
            {j.merged_into_id ? <Badge variant="outline">Unificado a outro registro</Badge> : null}
            <span>Última confirmação: {formatDate(j.last_verified_at as string | null, "nunca")} · Última busca: {formatDate(j.last_checked_at as string | null, "nunca")}</span>
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline"><Link href={`/jornalistas/${id}`}>Ver perfil <ExternalLink aria-hidden /></Link></Button>
            <ActionButton variant="outline" action={enqueueVerification.bind(null, id)}>Verificar agora</ActionButton>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Dados do perfil</CardTitle></CardHeader>
            <CardContent>
              <JournalistForm
                journalistId={id}
                defaults={{
                  fullName: j.full_name as string,
                  professionalName: (j.professional_name as string | null) ?? "",
                  biography: (j.biography as string | null) ?? "",
                  professionalStatus: j.professional_status as ProfessionalStatus,
                  profilePhotoUrl: (j.profile_photo_url as string | null) ?? "",
                  photoAuthorized: j.photo_authorized as boolean,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vínculos profissionais</CardTitle>
              <CardDescription>Encerre vínculos em vez de apagá-los: o histórico é preservado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(snap?.current_employments ?? []).map((e) => (
                <div key={e.id} className="flex flex-col gap-2 rounded-md border p-3 lg:flex-row lg:items-end lg:justify-between">
                  <div><EmploymentLine employment={e} /><VerificationBadge status={e.verification_status} className="mt-1" /></div>
                  <EndEmploymentInline journalistId={id} employmentId={e.id} />
                </div>
              ))}
              {(snap?.past_employments ?? []).length ? (
                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-medium">Vínculos encerrados ({snap!.past_employments.length})</summary>
                  <div className="mt-3 space-y-3">
                    {snap!.past_employments.map((e) => (
                      <div key={e.id}><EmploymentLine employment={e} /><p className="text-xs text-muted-foreground">{formatDate(e.start_date, "?")} – {formatDate(e.end_date, "?")}</p></div>
                    ))}
                  </div>
                </details>
              ) : null}
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="mb-2 text-sm font-medium">Adicionar vínculo atual</p>
                <AdminEmploymentForm
                  journalistId={id}
                  outlets={outlets.map((o) => ({ id: o.id, label: o.name }))}
                  locations={locations.map((l) => ({ id: l.id, label: locationLabel(l) }))}
                  categories={categoryOptions}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Contatos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {(contacts.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum contato.</p> : (
                <ul className="space-y-2">
                  {(contacts.data ?? []).map((c) => (
                    <li key={c.id as string} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{CONTACT_TYPE_LABELS[c.contact_type as ContactType]}{c.is_primary ? " · preferencial" : ""}</p>
                        <p className="break-all font-medium">{c.contact_value as string}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <VerificationBadge status={c.verification_status as VerificationStatus} />
                          <Badge variant="outline">{CONTACT_VISIBILITY_LABELS[c.visibility as ContactVisibility]}</Badge>
                          {!c.source_id ? <Badge variant="warning">Sem fonte</Badge> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(["assinantes", "restrito", "oculto"] as const).filter((v) => v !== c.visibility).map((v) => (
                          <ActionButton key={v} size="sm" variant="outline" action={updateContactVisibility.bind(null, id, c.id as string, v)}>
                            {v === "assinantes" ? "Liberar" : v === "restrito" ? "Restringir" : "Ocultar"}
                          </ActionButton>
                        ))}
                        <ActionButton size="sm" variant="ghost" confirmText="Remover este contato?" action={deleteContact.bind(null, id, c.id as string)}>Remover</ActionButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="mb-2 text-sm font-medium">Adicionar contato profissional</p>
                <AdminContactForm journalistId={id} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Evidências</CardTitle><CardDescription>Fontes que sustentam os dados. Evidências demonstrativas nunca confirmam perfis.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {(evidence.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma evidência.</p> : (
                <ul className="space-y-2">
                  {(evidence.data ?? []).map((ev) => (
                    <li key={ev.id as string} className="rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={ev.is_demo ? "warning" : "outline"}>{EVIDENCE_TYPE_LABELS[ev.evidence_type as EvidenceType]}</Badge>
                        <Badge variant={ev.review_status === "aceita" ? "success" : ev.review_status === "rejeitada" ? "danger" : "outline"}>{ev.review_status as string}</Badge>
                        {ev.confidence_score !== null ? <span className="text-xs text-muted-foreground">confiança {Number(ev.confidence_score).toFixed(2)}</span> : null}
                        <span className="text-xs text-muted-foreground">{formatDate((ev.observed_at ?? ev.collected_at) as string)}</span>
                      </div>
                      {ev.source_url ? (
                        <a href={ev.source_url as string} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 text-info hover:underline">{(ev.source_title ?? ev.source_url) as string} <ExternalLink className="size-3" aria-hidden /></a>
                      ) : <p className="mt-1">{ev.source_title as string}</p>}
                      {ev.review_status === "pendente" && !ev.is_demo ? (
                        <div className="mt-2 flex gap-2">
                          <ActionButton size="sm" variant="outline" action={reviewEvidence.bind(null, id, ev.id as string, "aceita")}>Aceitar</ActionButton>
                          <ActionButton size="sm" variant="ghost" action={reviewEvidence.bind(null, id, ev.id as string, "rejeitada")}>Rejeitar</ActionButton>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="mb-2 text-sm font-medium">Registrar evidência</p>
                <AdminEvidenceForm journalistId={id} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Histórico de alterações</CardTitle><CardDescription>Últimas 50 alterações registradas automaticamente.</CardDescription></CardHeader>
            <CardContent>
              {(history.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Sem alterações registradas.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Quando</TableHead><TableHead>Entidade</TableHead><TableHead>Campo</TableHead><TableHead>Origem</TableHead><TableHead>Novo valor</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(history.data ?? []).map((h) => (
                      <TableRow key={h.id as string}>
                        <TableCell className="whitespace-nowrap text-xs">{formatDateTime(h.changed_at as string)}</TableCell>
                        <TableCell className="text-xs">{h.entity_type as string}</TableCell>
                        <TableCell className="text-xs">{h.field_name as string}</TableCell>
                        <TableCell className="text-xs"><Badge variant="outline">{h.change_source as string}</Badge></TableCell>
                        <TableCell className="max-w-64 truncate text-xs" title={JSON.stringify(h.new_value)}>{h.field_name === "*criado*" || h.field_name === "*removido*" ? "—" : JSON.stringify(h.new_value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Situação de verificação</CardTitle><CardDescription>Confirmar exige evidência real aceita.</CardDescription></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {VERIFICATION_STATUSES.filter((s) => s !== j.verification_status).map((s) => (
                <ActionButton key={s} size="sm" variant="outline" action={setVerificationStatus.bind(null, id, s)}>{VERIFICATION_LABELS[s]}</ActionButton>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Verificações recentes</CardTitle></CardHeader>
            <CardContent>
              {(jobs.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma verificação executada.</p> : (
                <ul className="space-y-2 text-sm">
                  {(jobs.data ?? []).map((job) => (
                    <li key={job.id as string} className="rounded-md border p-2">
                      <div className="flex justify-between gap-2"><Badge variant="outline">{job.status as string}</Badge><span className="text-xs text-muted-foreground">{formatDateTime((job.finished_at ?? job.scheduled_at) as string)}</span></div>
                      {job.error_message ? <p className="mt-1 text-xs text-muted-foreground">{job.error_message as string}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Visibilidade e exclusão</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              <ActionButton variant="outline" action={setJournalistHidden.bind(null, id, !j.is_hidden)}>
                {j.is_hidden ? "Tornar visível nas buscas" : "Ocultar das buscas"}
              </ActionButton>
              <ConfirmDeleteButton
                action={deleteJournalist.bind(null, id)}
                label="Excluir registro"
                confirmText="Excluir definitivamente este registro e todos os dados vinculados? Esta ação não pode ser desfeita."
              />
              <p className="text-xs text-muted-foreground">Prefira atender exclusões pelo fluxo de solicitações LGPD, que registra a solicitação.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
