import { describe, expect, it, vi } from "vitest";
import { BraveSearchProvider } from "@/lib/verification/providers/brave-provider";

describe("adaptador Brave Search", () => {
  it("não é considerado configurado sem chave", async () => {
    const p = new BraveSearchProvider(undefined);
    expect(p.isConfigured).toBe(false);
    await expect(p.search({ journalistId: "1", text: "x" })).rejects.toThrow("não configurada");
  });

  it("envia a chave no cabeçalho e normaliza resultados", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ web: { results: [
        { title: "<strong>Ana</strong> Ribeiro", url: "https://a.example/x", description: "Repórter <em>de</em> política", page_age: "2026-10-01T00:00:00" },
        { title: "sem url" },
        { title: "js", url: "javascript:alert(1)" },
      ] } }), { status: 200 }),
    );
    const p = new BraveSearchProvider("chave-teste", fetchMock as unknown as typeof fetch);
    const results = await p.search({ journalistId: "1", text: '"Ana Ribeiro" jornalista' });
    expect(results).toEqual([{ url: "https://a.example/x", title: "Ana Ribeiro", snippet: "Repórter de política", publishedAt: "2026-10-01T00:00:00", provider: "brave" }]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.searchParams.get("q")).toBe('"Ana Ribeiro" jornalista');
    expect((init.headers as Record<string, string>)["X-Subscription-Token"]).toBe("chave-teste");
  });

  it("trata limite de requisições e erros HTTP", async () => {
    const p429 = new BraveSearchProvider("k", (async () => new Response("", { status: 429 })) as unknown as typeof fetch);
    await expect(p429.search({ journalistId: "1", text: "x" })).rejects.toThrow("429");
    const p500 = new BraveSearchProvider("k", (async () => new Response("", { status: 500 })) as unknown as typeof fetch);
    await expect(p500.search({ journalistId: "1", text: "x" })).rejects.toThrow("500");
  });
});
