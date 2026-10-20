import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, History, Mail, Search, ShieldCheck, SlidersHorizontal, Star, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { can, isAdminRole } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { getCategories, groupCategories } from "@/lib/data/reference";
import { formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Visão geral" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const params = await searchParams;
  const supabase = await createClient();

  const [favorites, mailings, interactions, ownJournalist, claims, categories] = await Promise.all([
    supabase.from("favorites").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("mailing_lists").select("*", { count: "exact", head: true }),
    supabase.from("journalist_interactions").select("*", { count: "exact", head: true }).eq("owner_id", user.id),
    user.role === "jornalista"
      ? supabase.from("journalists").select("id, full_name, verification_status, last_verified_at").eq("claimed_by", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    user.role === "jornalista"
      ? supabase.from("profile_claims").select("id, status").eq("user_id", user.id).eq("status", "pendente")
      : Promise.resolve({ data: [] }),
    getCategories(),
  ]);

  const firstName = user.fullName.split(" ")[0];
  const quickCategories = groupCategories(categories).slice(0, 8);

  return (
    <>
      <PageHeader eyebrow="Visão geral" title={`Olá, ${firstName}`} description="Atalhos para o seu trabalho no Radar de Imprensa." />
      {params.acesso === "negado" ? (
        <Alert variant="warning" className="mb-6">
          <TriangleAlert />
          <AlertDescription>Você não tem permissão para acessar a área solicitada.</AlertDescription>
        </Alert>
      ) : null}

      {user.role === "jornalista" ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent" aria-hidden /> Seu perfil profissional
            </CardTitle>
            <CardDescription>
              {ownJournalist.data
                ? "Seu perfil está vinculado à sua conta. Mantenha seus dados profissionais atualizados."
                : (claims.data?.length ?? 0) > 0
                  ? "Sua reivindicação está em análise pela administração."
                  : "Reivindique seu perfil para corrigir dados, escolher o canal de contato preferido e confirmar suas informações."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={ownJournalist.data ? "/meu-perfil" : "/reivindicar-perfil"}>
                {ownJournalist.data ? "Gerenciar meu perfil" : "Reivindicar meu perfil"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {can(user.role, "favorites.manage") ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Favoritos" value={formatNumber(favorites.count ?? 0)} icon={Star} />
          <StatCard label="Mailings acessíveis" value={formatNumber(mailings.count ?? 0)} icon={Mail} hint="Seus e os compartilhados pela organização" />
          <StatCard label="Interações registradas" value={formatNumber(interactions.count ?? 0)} icon={History} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="size-4" aria-hidden /> Busca rápida por editoria
            </CardTitle>
            <CardDescription>Abra a busca já filtrada e refine por estado, cidade e veículo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {quickCategories.map((g) => (
              <Button key={g.parent.id} asChild variant="outline" size="sm">
                <Link href={`/jornalistas?editoria=${g.parent.id}`}>{g.parent.name}</Link>
              </Button>
            ))}
            <Button asChild size="sm">
              <Link href="/jornalistas">Busca avançada</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgeCheck className="size-4" aria-hidden /> Como ler a confiança dos dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-accent">Confirmado</strong>: revisado por pessoa com evidência ou confirmado pelo titular.</p>
            <p><strong className="text-info">Provável</strong>: indícios consistentes, ainda sem confirmação formal.</p>
            <p><strong className="text-warning">Desatualizado</strong>: a última confirmação é antiga; verifique antes de usar.</p>
            <p>Datas de última confirmação, evidência e busca são exibidas separadamente em cada perfil.</p>
          </CardContent>
        </Card>
      </div>

      {isAdminRole(user.role) ? (
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link href="/admin">
              <SlidersHorizontal aria-hidden /> Ir para o painel administrativo
            </Link>
          </Button>
        </div>
      ) : null}
    </>
  );
}
