import type { Metadata } from "next";
import Link from "next/link";
import { Search, TriangleAlert } from "lucide-react";
import { EmploymentLine } from "@/components/journalists/employment-line";
import { ClaimDialog } from "@/components/profile/claim-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { searchJournalists } from "@/lib/data/journalists";
import { CLAIM_METHOD_LABELS } from "@/lib/domain/labels";
import type { ClaimMethod } from "@/lib/domain/enums";
import type { SearchResult } from "@/lib/domain/types";
import { AppError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { DEFAULT_FILTERS } from "@/lib/search/filters";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reivindicar perfil" };

const STATUS_LABEL = { pendente: "Em análise", aprovada: "Aprovada", rejeitada: "Recusada" } as const;

export default async function ClaimProfilePage({ searchParams }: PageProps<"/reivindicar-perfil">) {
  const user = await requirePermission("profile.claim");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 120) : "";
  const supabase = await createClient();

  const [{ data: claims }, { data: owned }] = await Promise.all([
    supabase.from("profile_claims").select("id, journalist_id, verification_method, status, created_at, review_notes").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("journalists").select("id, full_name").eq("claimed_by", user.id).maybeSingle(),
  ]);

  let results: SearchResult | null = null;
  let error: string | null = null;
  if (q.length >= 3 && !owned) {
    try {
      results = await searchJournalists({ ...DEFAULT_FILTERS, q, atual: false }, 20);
    } catch (e) {
      error = e instanceof AppError ? e.message : "Erro na busca.";
    }
  }

  return (
    <>
      <PageHeader title="Reivindicar perfil" description="Jornalistas podem assumir a gestão do próprio perfil para corrigir dados e escolher o canal de contato preferido." />
      {owned ? (
        <Alert variant="success" className="mb-6">
          <AlertDescription>
            Sua conta já está vinculada ao perfil de <strong>{owned.full_name as string}</strong>.{" "}
            <Link href="/meu-perfil" className="font-medium text-info hover:underline">Gerenciar meu perfil</Link>
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-4">
          {!owned ? (
            <form method="get" className="flex items-end gap-2 rounded-lg border bg-surface p-4">
              <div className="flex-1">
                <Label htmlFor="claim-q">Procure seu nome</Label>
                <Input id="claim-q" name="q" defaultValue={q} minLength={3} className="mt-1.5" placeholder="Nome completo ou profissional" />
              </div>
              <Button type="submit"><Search aria-hidden /> Buscar</Button>
            </form>
          ) : null}
          {error ? <Alert variant="danger"><TriangleAlert /><AlertDescription>{error}</AlertDescription></Alert> : null}
          {results ? (
            results.items.length === 0 ? (
              <EmptyState
                title="Nenhum perfil encontrado"
                description={<>Se você não está cadastrado, não é preciso fazer nada. Para pedir inclusão ou correção, use a <Link href="/privacidade#solicitacoes" className="text-info hover:underline">página de privacidade</Link>.</>}
              />
            ) : (
              <ul className="space-y-3">
                {results.items.map((item) => (
                  <li key={item.id} className="flex flex-col gap-3 rounded-lg border bg-surface p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">{item.full_name}</p>
                      <div className="mt-1 space-y-1">
                        {item.current_employments.map((e) => <EmploymentLine key={e.id} employment={e} compact />)}
                      </div>
                    </div>
                    <ClaimDialog journalistId={item.id} name={item.full_name} />
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </section>
        <Card className="h-fit">
          <CardHeader><CardTitle>Minhas reivindicações</CardTitle></CardHeader>
          <CardContent>
            {(claims ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma reivindicação enviada.</p>
            ) : (
              <ul className="space-y-2">
                {(claims ?? []).map((c) => (
                  <li key={c.id as string} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span>{CLAIM_METHOD_LABELS[c.verification_method as ClaimMethod]}</span>
                      <Badge variant={c.status === "aprovada" ? "success" : c.status === "rejeitada" ? "danger" : "outline"}>
                        {STATUS_LABEL[c.status as keyof typeof STATUS_LABEL]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Enviada em {formatDate(c.created_at as string)}</p>
                    {c.review_notes ? <p className="mt-1 text-xs">{c.review_notes as string}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
