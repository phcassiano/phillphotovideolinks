import type { SearchProvider, SearchQuery, SearchResultItem } from "../types";

// Adaptador para a Brave Search API (API oficial e paga por uso, com plano gratuito
// limitado). Usa apenas título/trecho/URL retornados pela API — nenhuma página é
// baixada, portanto não há scraping nem contorno de paywall ou robots.txt.
// Observação: implementado conforme a documentação pública da API, mas NÃO foi
// exercitado com credenciais reais neste repositório.
interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
  page_age?: string;
}

export class BraveSearchProvider implements SearchProvider {
  readonly name = "brave";
  readonly isDemo = false;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly endpoint = "https://api.search.brave.com/res/v1/web/search",
  ) {}

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: SearchQuery, signal?: AbortSignal): Promise<SearchResultItem[]> {
    if (!this.apiKey) throw new Error("BRAVE_SEARCH_API_KEY não configurada");
    const url = new URL(this.endpoint);
    url.searchParams.set("q", query.text);
    url.searchParams.set("count", "10");
    const response = await this.fetchImpl(url, {
      headers: { Accept: "application/json", "X-Subscription-Token": this.apiKey },
      signal,
    });
    if (response.status === 429) throw new Error("Brave Search: limite de requisições atingido (429)");
    if (!response.ok) throw new Error(`Brave Search respondeu ${response.status}`);
    const body = (await response.json()) as { web?: { results?: BraveWebResult[] } };
    return (body.web?.results ?? [])
      .filter((r): r is Required<Pick<BraveWebResult, "url" | "title">> & BraveWebResult => Boolean(r.url && r.title))
      .filter((r) => /^https?:\/\//i.test(r.url))
      .map((r) => ({
        url: r.url,
        title: stripTags(r.title),
        snippet: stripTags(r.description ?? ""),
        publishedAt: r.page_age ?? null,
        provider: this.name,
      }));
  }
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
