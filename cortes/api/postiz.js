// Ponte para a API do Postiz (ela não aceita chamadas direto do navegador).
// A chave do Postiz vem do navegador a cada pedido e não é guardada aqui.
export const config = { runtime: "edge" };

const ORIGENS = /^https:\/\/(cortes\.phillcassiano\.com|cortes[a-z0-9-]*\.vercel\.app)(\/|$)|^http:\/\/localhost(:\d+)?(\/|$)/;
const CAMINHOS = /^\/(integrations|is-connected|upload-from-url|posts|find-slot(\/[\w-]+)?)$/;

export default async function handler(req) {
  const quem = req.headers.get("origin") || req.headers.get("referer") || "";
  if (!ORIGENS.test(quem)) return Response.json({ erro: "origem não permitida" }, { status: 403 });
  if (req.method !== "POST") return Response.json({ erro: "método não permitido" }, { status: 405 });
  let p;
  try {
    p = await req.json();
  } catch {
    return Response.json({ erro: "pedido inválido" }, { status: 400 });
  }
  const base = String(p.base || "https://api.postiz.com/public/v1").replace(/\/+$/, "");
  if (!/^https:\/\/[^/]+(\/[\w./-]*)?$/.test(base)) return Response.json({ erro: "endereço do Postiz inválido (use https://)" }, { status: 400 });
  if (!CAMINHOS.test(p.caminho || "")) return Response.json({ erro: "caminho não permitido" }, { status: 400 });
  if (!p.chave) return Response.json({ erro: "falta a chave da API do Postiz" }, { status: 400 });
  const metodo = p.metodo === "POST" ? "POST" : "GET";
  const r = await fetch(base + p.caminho, {
    method: metodo,
    headers: { Authorization: String(p.chave), "Content-Type": "application/json" },
    body: metodo === "POST" ? JSON.stringify(p.corpo ?? {}) : undefined,
  });
  const txt = await r.text();
  return new Response(txt, { status: r.status, headers: { "Content-Type": r.headers.get("content-type") || "application/json" } });
}
