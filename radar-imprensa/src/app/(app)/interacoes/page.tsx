import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { DeleteInteractionButton } from "@/components/forms/delete-interaction-button";
import { InteractionForm } from "@/components/forms/interaction-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { getJournalistCards, getJournalistProfile } from "@/lib/data/journalists";
import type { InteractionType } from "@/lib/domain/enums";
import { INTERACTION_TYPE_LABELS } from "@/lib/domain/labels";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Interações" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InteractionsPage({ searchParams }: PageProps<"/interacoes">) {
  const user = await requirePermission("interactions.manage");
  const sp = await searchParams;
  const preselected = typeof sp.jornalista === "string" && UUID_RE.test(sp.jornalista) ? sp.jornalista : undefined;
  const supabase = await createClient();

  const [{ data: interactions }, { data: favorites }, { data: members }] = await Promise.all([
    supabase
      .from("journalist_interactions")
      .select("id, journalist_id, interaction_type, subject, notes, interaction_date")
      .eq("owner_id", user.id)
      .order("interaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("favorites").select("journalist_id").eq("user_id", user.id).limit(500),
    supabase.from("mailing_list_members").select("journalist_id").limit(1000),
  ]);

  const ids = new Set<string>([
    ...(interactions ?? []).map((i) => i.journalist_id as string),
    ...(favorites ?? []).map((f) => f.journalist_id as string),
    ...(members ?? []).map((m) => m.journalist_id as string),
  ]);
  const cards = await getJournalistCards([...ids]);
  const names = new Map(cards.map((c) => [c.id, c.full_name]));
  const options = cards.filter((c) => c.is_available).map((c) => ({ id: c.id, name: c.full_name }));
  if (preselected && !names.has(preselected)) {
    const profile = await getJournalistProfile(preselected).catch(() => null);
    if (profile) options.unshift({ id: profile.id, name: profile.full_name });
  }
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  return (
    <>
      <PageHeader title="Histórico de interações" description="Registro privado do seu relacionamento com jornalistas. Somente você tem acesso." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section aria-label="Interações registradas">
          {(interactions ?? []).length === 0 ? (
            <EmptyState icon={History} title="Nenhuma interação registrada" description="Registre envios de releases, entrevistas e conversas para manter o histórico." />
          ) : (
            <ol className="space-y-3">
              {(interactions ?? []).map((i) => (
                <li key={i.id as string} className="rounded-lg border bg-surface p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{INTERACTION_TYPE_LABELS[i.interaction_type as InteractionType]}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(i.interaction_date as string)}</span>
                      </div>
                      <p className="mt-1 font-medium">{i.subject as string}</p>
                      <Link href={`/jornalistas/${i.journalist_id}`} className="text-sm text-info hover:underline">
                        {names.get(i.journalist_id as string) ?? "Perfil indisponível"}
                      </Link>
                      {i.notes ? <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{i.notes as string}</p> : null}
                    </div>
                    <DeleteInteractionButton id={i.id as string} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Nova interação</CardTitle>
            <CardDescription>Use apenas para fins profissionais.</CardDescription>
          </CardHeader>
          <CardContent>
            <InteractionForm journalists={options} defaultJournalistId={preselected} today={today} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
