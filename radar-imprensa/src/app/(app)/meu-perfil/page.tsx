import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { AccountForm } from "@/components/profile/account-form";
import { ConfirmProfileButton, OwnContacts, OwnEmployments, OwnProfileForm, OwnTopics, type OwnContact } from "@/components/profile/own-profile-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { VerificationBadge } from "@/components/ui/verification-badge";
import { requireUser } from "@/lib/auth/session";
import { getCategories, getLocations, getOutlets, groupCategories, locationLabel } from "@/lib/data/reference";
import type { ProfessionalStatus, VerificationStatus } from "@/lib/domain/enums";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function MyProfilePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: journalist } =
    user.role === "jornalista"
      ? await supabase
          .from("journalists")
          .select("id, full_name, professional_name, biography, professional_status, verification_status, last_verified_at")
          .eq("claimed_by", user.id)
          .maybeSingle()
      : { data: null };

  let ownData: {
    contacts: OwnContact[];
    employments: { id: string; outlet: string; job_title: string | null; start_date: string | null; verification_status: VerificationStatus }[];
    topics: { id: string; name: string }[];
  } | null = null;

  if (journalist) {
    const [contacts, employments, topics] = await Promise.all([
      supabase.from("journalist_contacts").select("id, contact_type, contact_value, is_primary, visibility, verification_status").eq("journalist_id", journalist.id).order("created_at"),
      supabase.from("journalist_employments").select("id, job_title, start_date, verification_status, media_outlets(name)").eq("journalist_id", journalist.id).eq("is_current", true),
      supabase.from("journalist_topics").select("topics(id, name)").eq("journalist_id", journalist.id),
    ]);
    ownData = {
      contacts: (contacts.data ?? []) as OwnContact[],
      employments: (employments.data ?? []).map((e) => {
        const outlet = e.media_outlets as unknown as { name: string } | null;
        return { id: e.id as string, outlet: outlet?.name ?? "—", job_title: e.job_title as string | null, start_date: e.start_date as string | null, verification_status: e.verification_status as VerificationStatus };
      }),
      topics: (topics.data ?? []).map((t) => t.topics as unknown as { id: string; name: string }).filter(Boolean),
    };
  }

  const [outlets, locations, categories] = journalist ? await Promise.all([getOutlets(), getLocations(), getCategories()]) : [[], [], []];
  const categoryOptions = groupCategories(categories).flatMap((g) => [
    { id: g.parent.id, label: g.parent.name },
    ...g.children.map((c) => ({ id: c.id, label: `${g.parent.name} › ${c.name}` })),
  ]);

  return (
    <>
      <PageHeader title="Meu perfil" description="Dados da sua conta e, para jornalistas, do seu perfil profissional." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {user.role === "jornalista" && !journalist ? (
            <Card>
              <CardHeader>
                <CardTitle>Nenhum perfil profissional vinculado</CardTitle>
                <CardDescription>Reivindique seu perfil para gerenciar seus dados profissionais.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild><Link href="/reivindicar-perfil">Reivindicar perfil</Link></Button>
              </CardContent>
            </Card>
          ) : null}

          {journalist && ownData ? (
            <>
              <Card>
                <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-accent" aria-hidden /> {journalist.full_name as string}</CardTitle>
                    <CardDescription>
                      Última confirmação: {formatDate(journalist.last_verified_at as string | null, "nunca")}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <VerificationBadge status={journalist.verification_status as VerificationStatus} />
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/jornalistas/${journalist.id}`}>Ver público <ExternalLink aria-hidden /></Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Alterações feitas por você entram como “provável” e ficam registradas no histórico. Use o botão abaixo para
                    confirmar que seus dados atuais estão corretos. O nome completo só pode ser alterado por solicitação de correção.
                  </p>
                  <ConfirmProfileButton />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Dados profissionais</CardTitle></CardHeader>
                <CardContent>
                  <OwnProfileForm
                    initial={{
                      professionalName: (journalist.professional_name as string | null) ?? "",
                      biography: (journalist.biography as string | null) ?? "",
                      professionalStatus: journalist.professional_status as ProfessionalStatus,
                    }}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Contatos e canal preferencial</CardTitle>
                  <CardDescription>Informe apenas canais profissionais. Você decide quais ficam visíveis aos usuários.</CardDescription>
                </CardHeader>
                <CardContent><OwnContacts contacts={ownData.contacts} /></CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Vínculos atuais</CardTitle>
                  <CardDescription>Vínculos encerrados permanecem no histórico.</CardDescription>
                </CardHeader>
                <CardContent>
                  <OwnEmployments
                    employments={ownData.employments}
                    outlets={outlets.map((o) => ({ id: o.id, name: o.name }))}
                    locations={locations.map((l) => ({ id: l.id, label: locationLabel(l) }))}
                    categories={categoryOptions}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Temas de interesse</CardTitle>
                  <CardDescription>Ajudam assessores a enviar pautas relevantes.</CardDescription>
                </CardHeader>
                <CardContent><OwnTopics topics={ownData.topics} /></CardContent>
              </Card>
            </>
          ) : null}
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conta</CardTitle>
              <CardDescription>
                {user.email} · {ROLE_LABELS[user.role]}
                {user.organizationName ? ` · ${user.organizationName}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent><AccountForm fullName={user.fullName} /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Privacidade</CardTitle>
              <CardDescription>Correção, ocultação, exclusão ou oposição ao tratamento.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline"><Link href={journalist ? `/privacidade?jornalista=${journalist.id}#solicitacoes` : "/privacidade#solicitacoes"}>Abrir solicitação</Link></Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
