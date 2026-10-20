import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { detectDuplicates, mergeFromSuggestion, rejectSuggestion, unmerge } from "@/app/actions/admin/duplicates";

export const metadata: Metadata = { title: "Duplicidades" };

export default async function DuplicatesPage() {
  await requirePermission("admin.reviews");
  const supabase = await createClient();
  const [suggestions, merges] = await Promise.all([
    supabase
      .from("journalist_merge_suggestions")
      .select("id, score, reasons, created_at, a:journalists!journalist_merge_suggestions_journalist_a_id_fkey(id, full_name, verification_status, claimed_by), b:journalists!journalist_merge_suggestions_journalist_b_id_fkey(id, full_name, verification_status, claimed_by)")
      .eq("status", "pendente")
      .order("score", { ascending: false })
      .limit(100),
    supabase
      .from("journalist_merges")
      .select("id, merged_at, reverted_at, survivor:journalists!journalist_merges_survivor_id_fkey(id, full_name), merged:journalists!journalist_merges_merged_id_fkey(id, full_name)")
      .order("merged_at", { ascending: false })
      .limit(50),
  ]);

  type J = { id: string; full_name: string; verification_status: string; claimed_by: string | null };

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Resolução de identidade"
        description="Um jornalista pode mudar de veículo, editoria e cidade sem se tornar outra pessoa — e duas pessoas podem ter o mesmo nome."
        actions={<ActionButton action={detectDuplicates}>Detectar possíveis duplicidades</ActionButton>}
      />
      <Alert variant="info" className="mb-6">
        <AlertDescription>
          A detecção considera nome, nome profissional, histórico de veículos, assinaturas em matérias e identificadores profissionais.
          Nenhuma unificação é automática; unificações podem ser desfeitas.
        </AlertDescription>
      </Alert>
      <section className="space-y-4" aria-labelledby="sugestoes">
        <h2 id="sugestoes" className="text-lg font-semibold text-primary">Sugestões pendentes</h2>
        {(suggestions.data ?? []).length === 0 ? <EmptyState title="Nenhuma sugestão pendente" description="Execute a detecção para avaliar a base." /> : (
          (suggestions.data ?? []).map((s) => {
            const a = s.a as unknown as J;
            const b = s.b as unknown as J;
            return (
              <Card key={s.id as string}>
                <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-base">
                      <Link href={`/admin/jornalistas/${a.id}`} className="hover:underline">{a.full_name}</Link>
                      <span className="mx-2 text-muted-foreground">×</span>
                      <Link href={`/admin/jornalistas/${b.id}`} className="hover:underline">{b.full_name}</Link>
                    </CardTitle>
                    <CardDescription>Pontuação {Number(s.score).toFixed(2)} (apoio à decisão) · {formatDateTime(s.created_at as string)}</CardDescription>
                  </div>
                  <Badge variant={Number(s.score) >= 0.75 ? "warning" : "outline"}>{Number(s.score) >= 0.75 ? "Forte" : "Possível"}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="list-disc pl-5 text-sm">{(s.reasons as string[]).map((r) => <li key={r}>{r}</li>)}</ul>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton size="sm" variant="outline" confirmText={`Manter "${a.full_name}" e unificar o outro registro a ele?`} action={mergeFromSuggestion.bind(null, s.id as string, a.id, b.id)}>
                      Unificar mantendo o 1º
                    </ActionButton>
                    <ActionButton size="sm" variant="outline" confirmText={`Manter "${b.full_name}" e unificar o outro registro a ele?`} action={mergeFromSuggestion.bind(null, s.id as string, b.id, a.id)}>
                      Unificar mantendo o 2º
                    </ActionButton>
                    <ActionButton size="sm" variant="ghost" action={rejectSuggestion.bind(null, s.id as string)}>São pessoas diferentes</ActionButton>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
      <section className="mt-8 space-y-3" aria-labelledby="unificacoes">
        <h2 id="unificacoes" className="text-lg font-semibold text-primary">Unificações realizadas</h2>
        {(merges.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma unificação.</p> : (
          <ul className="space-y-2">
            {(merges.data ?? []).map((m) => {
              const survivor = m.survivor as unknown as { id: string; full_name: string };
              const merged = m.merged as unknown as { id: string; full_name: string };
              return (
                <li key={m.id as string} className="flex flex-col gap-2 rounded-lg border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm">
                    <strong>{merged.full_name}</strong> unificado a <Link href={`/admin/jornalistas/${survivor.id}`} className="text-info hover:underline">{survivor.full_name}</Link> em {formatDateTime(m.merged_at as string)}
                    {m.reverted_at ? <Badge variant="outline" className="ml-2">Desfeita em {formatDateTime(m.reverted_at as string)}</Badge> : null}
                  </p>
                  {!m.reverted_at ? <ActionButton size="sm" variant="outline" confirmText="Separar novamente os dois registros?" action={unmerge.bind(null, m.id as string)}>Desfazer unificação</ActionButton> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
