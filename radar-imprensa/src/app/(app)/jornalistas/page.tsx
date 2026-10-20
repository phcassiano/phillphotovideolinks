import type { Metadata } from "next";
import { SearchX, TriangleAlert } from "lucide-react";
import { SearchFiltersForm } from "@/components/journalists/search-filters";
import { SearchResults } from "@/components/journalists/search-results";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getFavoriteIds, searchJournalists } from "@/lib/data/journalists";
import { listMailings } from "@/lib/data/mailings";
import { getCategories, getLocations, getOutlets, getStates, groupCategories } from "@/lib/data/reference";
import type { SearchResult } from "@/lib/domain/types";
import { AppError } from "@/lib/errors";
import { pluralize } from "@/lib/format";
import { hasActiveFilters, parseSearchParams, toSearchParams, totalPages } from "@/lib/search/filters";

export const metadata: Metadata = { title: "Jornalistas" };

export default async function JournalistsPage({ searchParams }: PageProps<"/jornalistas">) {
  const user = await requirePermission("journalists.search");
  const filters = parseSearchParams(await searchParams);
  const canManage = can(user.role, "mailings.manage");

  const [categories, states, cities, outlets] = await Promise.all([
    getCategories(),
    getStates(),
    filters.uf ? getLocations(filters.uf) : Promise.resolve([]),
    getOutlets(),
  ]);

  let result: SearchResult | null = null;
  let error: AppError | null = null;
  try {
    result = await searchJournalists(filters);
  } catch (e) {
    error = e instanceof AppError ? e : new AppError("Não foi possível realizar a busca.", "unknown");
  }

  const [favoriteIds, mailings] = canManage
    ? await Promise.all([getFavoriteIds(user.id), listMailings()])
    : [new Set<string>(), []];
  const ownMailings = mailings.filter((m) => m.owner_id === user.id).map((m) => ({ id: m.id, name: m.name }));
  const pages = result ? totalPages(result.total) : 1;

  return (
    <>
      <PageHeader
        title="Buscar jornalistas"
        description="Combine editoria, localização, veículo e cargo. Os critérios de vínculo são aplicados ao mesmo vínculo profissional e, por padrão, apenas aos vínculos atuais."
      />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="h-fit rounded-lg border bg-surface p-4 lg:sticky lg:top-20">
          <SearchFiltersForm
            filters={filters}
            options={{
              categories: groupCategories(categories).map((g) => ({
                parent: { id: g.parent.id, name: g.parent.name },
                children: g.children.map((c) => ({ id: c.id, name: c.name })),
              })),
              states,
              cities,
              outlets: outlets.map((o) => ({ id: o.id, name: o.name })),
            }}
          />
        </aside>
        <section aria-labelledby="resultados" className="min-w-0 space-y-4">
          <h2 id="resultados" className="sr-only">Resultados</h2>
          {error ? (
            <Alert variant={error.kind === "rate_limited" ? "warning" : "danger"}>
              <TriangleAlert />
              <div>
                <AlertTitle>{error.kind === "rate_limited" ? "Limite de buscas atingido" : "Erro na busca"}</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
              </div>
            </Alert>
          ) : null}
          {result ? (
            <>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {pluralize(result.total, "jornalista encontrado", "jornalistas encontrados")}
                {result.total > 1000 ? " (exibindo os 1.000 mais relevantes; refine os filtros)" : ""}
              </p>
              {result.items.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum jornalista corresponde a esta combinação"
                  description={
                    hasActiveFilters(filters) ? (
                      <>
                        Tente remover um filtro (por exemplo, a cidade ou o tipo de mídia), incluir subeditorias da editoria escolhida
                        ou desmarcar &quot;Somente atuação atual&quot;. A base cobre apenas jornalistas cadastrados e não inventa resultados.
                      </>
                    ) : (
                      "Ainda não há jornalistas cadastrados. Administradores podem cadastrar ou importar registros."
                    )
                  }
                />
              ) : (
                <SearchResults items={result.items} favoriteIds={[...favoriteIds]} mailings={ownMailings} canManage={canManage} />
              )}
              <Pagination
                page={filters.pagina}
                totalPages={pages}
                hrefFor={(p) => `/jornalistas?${toSearchParams({ ...filters, pagina: p }).toString()}`}
              />
            </>
          ) : null}
        </section>
      </div>
    </>
  );
}
