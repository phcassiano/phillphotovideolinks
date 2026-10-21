import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ChangeList } from "@/components/admin/change-list";
import { ReviewButtons } from "@/components/admin/review-buttons";
import { ActionButton } from "@/components/admin/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import type { ChangeOp } from "@/lib/confidence/policy";
import type { ClaimMethod, EvidenceType, PrivacyRequestStatus, PrivacyRequestType, ProposalSource } from "@/lib/domain/enums";
import { CLAIM_METHOD_LABELS, EVIDENCE_TYPE_LABELS, PRIVACY_REQUEST_TYPE_LABELS, PRIVACY_STATUS_LABELS, PROPOSAL_SOURCE_LABELS } from "@/lib/domain/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { resolvePrivacyRequest, reviewClaim, reviewProposal } from "@/app/actions/admin/reviews";

export const metadata: Metadata = { title: "Revisões" };

export default async function ReviewsPage() {
  await requirePermission("admin.reviews");
  const supabase = await createClient();
  const [proposals, claims, privacy, outlets, demoSetting] = await Promise.all([
    supabase
      .from("change_proposals")
      .select("id, journalist_id, proposed_changes, evidence_ids, confidence_score, source, description, is_demo, created_at, journalists(full_name)")
      .eq("status", "pendente")
      .order("created_at")
      .limit(50),
    supabase
      .from("profile_claims")
      .select("id, journalist_id, user_id, verification_method, evidence_text, email_domain_match, created_at, journalists(full_name), profiles!profile_claims_user_id_fkey(full_name, email)")
      .eq("status", "pendente")
      .order("created_at"),
    supabase
      .from("privacy_requests")
      .select("id, journalist_id, request_type, details, contact_email, status, created_at, journalists(full_name)")
      .in("status", ["aberta", "em_analise"])
      .order("created_at"),
    supabase.from("media_outlets").select("id, name").limit(5000),
    supabase.from("app_settings").select("value").eq("key", "verification.allow_demo_apply").maybeSingle(),
  ]);
  const allowDemo = Number(demoSetting.data?.value ?? 0) === 1;

  const evidenceIds = (proposals.data ?? []).flatMap((p) => p.evidence_ids as string[]);
  const journalistIds = (proposals.data ?? []).map((p) => p.journalist_id as string);
  const [evidence, employments] = await Promise.all([
    evidenceIds.length
      ? supabase.from("source_evidence").select("id, source_url, source_title, evidence_type, confidence_score, is_demo, observed_at").in("id", evidenceIds)
      : Promise.resolve({ data: [] as never[] }),
    journalistIds.length
      ? supabase.from("journalist_employments").select("id, job_title, media_outlets(name)").in("journalist_id", journalistIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const evidenceById = new Map((evidence.data ?? []).map((e) => [e.id as string, e]));
  const names = {
    outlets: new Map((outlets.data ?? []).map((o) => [o.id as string, o.name as string])),
    employments: new Map(
      (employments.data ?? []).map((e) => [e.id as string, `${(e.job_title as string | null) ?? "cargo"} · ${(e.media_outlets as unknown as { name: string } | null)?.name ?? ""}`]),
    ),
  };

  return (
    <>
      <PageHeader eyebrow="Administração" title="Revisões pendentes" description="Mudanças de emprego e contato só são publicadas após revisão humana com evidência adequada." />
      <div className="space-y-8">
        <section aria-labelledby="propostas">
          <h2 id="propostas" className="mb-3 text-lg font-semibold text-primary">Propostas de alteração ({proposals.data?.length ?? 0})</h2>
          {(proposals.data ?? []).length === 0 ? <EmptyState title="Nenhuma proposta pendente" /> : (
            <div className="space-y-4">
              {(proposals.data ?? []).map((p) => {
                const j = p.journalists as unknown as { full_name: string } | null;
                const evs = (p.evidence_ids as string[]).map((id) => evidenceById.get(id)).filter(Boolean);
                const demoBlocked = Boolean(p.is_demo) && !allowDemo;
                return (
                  <Card key={p.id as string}>
                    <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle><Link href={`/admin/jornalistas/${p.journalist_id}`} className="hover:underline">{j?.full_name ?? "—"}</Link></CardTitle>
                        <CardDescription>
                          {PROPOSAL_SOURCE_LABELS[p.source as ProposalSource]} · {formatDateTime(p.created_at as string)}
                          {p.confidence_score !== null ? ` · confiança agregada ${Number(p.confidence_score).toFixed(2)} (apoio à decisão, não prova)` : ""}
                        </CardDescription>
                      </div>
                      {p.is_demo ? <Badge variant="warning">Demonstrativa</Badge> : null}
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-[1fr_320px]">
                      <div className="space-y-3">
                        <ChangeList changes={p.proposed_changes as ChangeOp[]} names={names} />
                        {p.description ? <p className="whitespace-pre-line rounded-md bg-muted p-3 text-xs">{p.description as string}</p> : null}
                        {evs.length ? (
                          <ul className="space-y-1 text-xs">
                            {evs.map((e) => (
                              <li key={e!.id as string} className="flex flex-wrap items-center gap-2">
                                <Badge variant={e!.is_demo ? "warning" : "outline"}>{EVIDENCE_TYPE_LABELS[e!.evidence_type as EvidenceType]}</Badge>
                                {e!.source_url ? (
                                  <a href={e!.source_url as string} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-info hover:underline">{(e!.source_title ?? e!.source_url) as string} <ExternalLink className="size-3" aria-hidden /></a>
                                ) : <span>{e!.source_title as string}</span>}
                                <span className="text-muted-foreground">{formatDate(e!.observed_at as string | null, "sem data")}</span>
                              </li>
                            ))}
                          </ul>
                        ) : <p className="text-xs text-muted-foreground">Sem evidência vinculada.</p>}
                      </div>
                      <ReviewButtons
                        onDecide={async (approve, notes) => {
                          "use server";
                          return reviewProposal(p.id as string, approve, notes);
                        }}
                        approveDisabledReason={demoBlocked ? "Propostas demonstrativas não podem ser aplicadas neste ambiente." : undefined}
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="reivindicacoes">
          <h2 id="reivindicacoes" className="mb-3 text-lg font-semibold text-primary">Reivindicações de perfil ({claims.data?.length ?? 0})</h2>
          {(claims.data ?? []).length === 0 ? <EmptyState title="Nenhuma reivindicação pendente" /> : (
            <div className="grid gap-4 lg:grid-cols-2">
              {(claims.data ?? []).map((c) => {
                const j = c.journalists as unknown as { full_name: string } | null;
                const u = c.profiles as unknown as { full_name: string; email: string } | null;
                return (
                  <Card key={c.id as string}>
                    <CardHeader>
                      <CardTitle className="text-base"><Link href={`/admin/jornalistas/${c.journalist_id}`} className="hover:underline">{j?.full_name}</Link></CardTitle>
                      <CardDescription>Solicitado por {u?.full_name || "—"} ({u?.email}) em {formatDate(c.created_at as string)}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p>Método: {CLAIM_METHOD_LABELS[c.verification_method as ClaimMethod]}</p>
                      <p>{c.email_domain_match ? <Badge variant="success">E-mail do domínio de um veículo atual</Badge> : <Badge variant="outline">Domínio do e-mail não coincide com veículos atuais</Badge>}</p>
                      {c.evidence_text ? <p className="whitespace-pre-line rounded-md bg-muted p-3 text-xs">{c.evidence_text as string}</p> : null}
                      <ReviewButtons
                        approveLabel="Aprovar vínculo"
                        onDecide={async (approve, notes) => {
                          "use server";
                          return reviewClaim(c.id as string, approve, notes);
                        }}
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="privacidade">
          <h2 id="privacidade" className="mb-3 text-lg font-semibold text-primary">Solicitações de privacidade ({privacy.data?.length ?? 0})</h2>
          {(privacy.data ?? []).length === 0 ? <EmptyState title="Nenhuma solicitação aberta" /> : (
            <div className="grid gap-4 lg:grid-cols-2">
              {(privacy.data ?? []).map((r) => {
                const j = r.journalists as unknown as { full_name: string } | null;
                const type = r.request_type as PrivacyRequestType;
                return (
                  <Card key={r.id as string}>
                    <CardHeader>
                      <CardTitle className="text-base">{PRIVACY_REQUEST_TYPE_LABELS[type]}</CardTitle>
                      <CardDescription>
                        {formatDate(r.created_at as string)} · {PRIVACY_STATUS_LABELS[r.status as PrivacyRequestStatus]}
                        {j ? <> · perfil: <Link href={`/admin/jornalistas/${r.journalist_id}`} className="text-info hover:underline">{j.full_name}</Link></> : " · perfil não vinculado"}
                        {r.contact_email ? ` · resposta para ${r.contact_email}` : ""}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="whitespace-pre-line rounded-md bg-muted p-3 text-xs">{r.details as string}</p>
                      {["ocultacao", "oposicao", "exclusao"].includes(type) && !r.journalist_id ? (
                        <p className="text-xs text-warning">Vincule o perfil (identifique-o pelos detalhes) antes de atender: sem perfil vinculado, nenhuma ação automática é aplicada.</p>
                      ) : null}
                      {type === "exclusao" && r.journalist_id ? <p className="text-xs text-danger">Atender remove definitivamente a ficha e os dados derivados.</p> : null}
                      <div className="flex flex-wrap gap-2">
                        {r.status === "aberta" ? <ActionButton size="sm" variant="outline" action={resolvePrivacyRequest.bind(null, r.id as string, "em_analise", undefined)}>Marcar em análise</ActionButton> : null}
                        <ActionButton size="sm" variant="accent" confirmText="Confirmar atendimento da solicitação?" action={resolvePrivacyRequest.bind(null, r.id as string, "atendida", undefined)}>Atender</ActionButton>
                        <ActionButton size="sm" variant="outline" action={resolvePrivacyRequest.bind(null, r.id as string, "recusada", "Solicitação recusada após análise.")}>Recusar</ActionButton>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
