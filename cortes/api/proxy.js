// Repassa os pedaços do vídeo para o navegador (os servidores de vídeo da Twitch/Kick não liberam CORS).
// Só aceita servidores de vídeo conhecidos e pedidos vindos do próprio site.
export const config = { runtime: "edge" };

const HOSTS = [/\.cloudfront\.net$/, /\.ttvnw\.net$/, /\.twitchcdn\.net$/, /\.jtvnw\.net$/, /\.live-video\.net$/, /(^|\.)kick\.com$/, /\.kick\.com$/];
const ORIGENS = /^https:\/\/(cortes\.phillcassiano\.com|cortes[a-z0-9-]*\.vercel\.app)(\/|$)|^http:\/\/localhost(:\d+)?(\/|$)/;

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (req.method !== "GET") return new Response("método não permitido", { status: 405 });
  const quem = req.headers.get("origin") || req.headers.get("referer") || "";
  if (!ORIGENS.test(quem)) return new Response("origem não permitida", { status: 403 });
  let alvo;
  try {
    alvo = new URL(new URL(req.url).searchParams.get("u") || "");
  } catch {
    return new Response("url inválida", { status: 400 });
  }
  if (alvo.protocol !== "https:" || !HOSTS.some((h) => h.test(alvo.hostname))) return new Response("servidor não permitido", { status: 403 });
  const headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36" };
  const range = req.headers.get("range");
  if (range) headers.Range = range;
  const r = await fetch(alvo, { headers, redirect: "follow" });
  const out = cors();
  for (const k of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = r.headers.get(k);
    if (v) out.set(k, v);
  }
  out.set("Cache-Control", "public, max-age=3600");
  return new Response(r.body, { status: r.status, headers: out });
}

function cors() {
  return new Headers({ "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Range", "Access-Control-Expose-Headers": "Content-Length, Content-Range" });
}
