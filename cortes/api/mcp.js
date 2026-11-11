// Conector MCP do Cortes para o Claude (Streamable HTTP, sem estado).
// Adicione no Claude: Configurações → Conectores → Adicionar conector personalizado → https://<site>/api/mcp
// As ferramentas só leem dados públicos e montam links; o processamento dos vídeos acontece no navegador.
export const config = { runtime: "edge" };

const VERSAO_PROTOCOLO = "2025-06-18";

const FERRAMENTAS = [
  {
    name: "abrir_cortes",
    description:
      "Monta um link que abre o site Cortes já carregando um vídeo (Twitch, Kick, TikTok, YouTube com o Ajudante, ou link direto .mp4/.m3u8) e começa a procurar os melhores momentos sozinho. Devolva o link para o usuário clicar: a análise e o corte rodam no navegador dele.",
    inputSchema: {
      type: "object",
      properties: {
        link: { type: "string", description: "Link do vídeo" },
        cortes: { type: "integer", minimum: 1, maximum: 30, description: "Quantos cortes procurar (padrão 6)" },
        duracao: { type: "integer", minimum: 12, maximum: 90, description: "Duração de cada corte em segundos (padrão 30)" },
        inicio: { type: "string", description: "Começar em (ex.: 1:00:00), opcional" },
        fim: { type: "string", description: "Terminar em (ex.: 2:30:00), opcional" },
        qualidade: { type: "integer", enum: [480, 720, 1080], description: "Qualidade dos cortes (padrão 720)" },
      },
      required: ["link"],
    },
  },
  {
    name: "info_video",
    description: "Mostra título, duração e qualidades disponíveis de um link da Twitch, Kick ou TikTok.",
    inputSchema: { type: "object", properties: { link: { type: "string" } }, required: ["link"] },
  },
  {
    name: "radar_tiktok",
    description:
      "Lista os vídeos de um perfil público do TikTok com visualizações, curtidas, comentários e data, para descobrir o que está viralizando e escolher o que cortar.",
    inputSchema: {
      type: "object",
      properties: {
        perfil: { type: "string", description: "@ do perfil ou link do perfil" },
        quantidade: { type: "integer", minimum: 5, maximum: 60, description: "Quantos vídeos olhar (padrão 30)" },
        ordenar: { type: "string", enum: ["views", "likes", "comentarios", "engajamento", "recentes"], description: "Padrão: views" },
      },
      required: ["perfil"],
    },
  },
  {
    name: "legenda_post",
    description: "Monta a legenda do post para Instagram, TikTok ou YouTube Shorts a partir do título do corte, com chamada para comentar e hashtags.",
    inputSchema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        rede: { type: "string", enum: ["instagram", "tiktok", "youtube"] },
        palavra_cta: { type: "string", description: "Palavra para pedir nos comentários (ex.: CORTES)" },
        hashtags: { type: "string", description: "Ex.: #gta6 #gtavi #cortes" },
      },
      required: ["titulo", "rede"],
    },
  },
];

const texto = (t, erro = false) => ({ content: [{ type: "text", text: t }], ...(erro ? { isError: true } : {}) });
const curto = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " mi" : n >= 1e3 ? Math.round(n / 1e3) + " mil" : String(n || 0));

async function chamar(nome, a, origem) {
  if (nome === "abrir_cortes") {
    if (!/^https?:\/\//.test(a.link || "")) return texto("Informe um link começando com https://", true);
    const q = new URLSearchParams({ link: a.link });
    for (const [k, v] of Object.entries({ cortes: a.cortes, duracao: a.duracao, de: a.inicio, ate: a.fim, qualidade: a.qualidade })) if (v != null && v !== "") q.set(k, String(v));
    const url = `${origem}/#auto&${q}`;
    return texto(`Link pronto. Abra no Chrome do computador e deixe a aba aberta: o site baixa o vídeo, acha os melhores momentos e mostra para aprovar.\n\n${url}`);
  }
  if (nome === "info_video") {
    const r = await fetch(`${origem}/api/resolver?url=${encodeURIComponent(a.link || "")}`);
    const j = await r.json();
    if (!r.ok) return texto(j.erro || "Não consegui abrir o link.", true);
    const qs = [...new Set(j.variantes.map((v) => v.altura).filter(Boolean))].join("p, ");
    return texto(`${j.titulo}\nOrigem: ${j.origem}\nDuração: ${j.duracao ? Math.round(j.duracao / 60) + " min" : "?"}\nQualidades: ${qs ? qs + "p" : "única"}`);
  }
  if (nome === "radar_tiktok") {
    const r = await fetch(`${origem}/api/radar?perfil=${encodeURIComponent(a.perfil || "")}&n=${a.quantidade || 30}`);
    const j = await r.json();
    if (!r.ok) return texto(j.erro || "Não consegui abrir o perfil.", true);
    const eng = (v) => (v.views ? (v.likes + v.comentarios + v.compartilhamentos) / v.views : 0);
    const ord = a.ordenar || "views";
    const vs = [...j.videos].sort((x, y) => (ord === "recentes" ? (y.data || 0) - (x.data || 0) : ord === "engajamento" ? eng(y) - eng(x) : (y[ord] || 0) - (x[ord] || 0)));
    const media = j.videos.reduce((s, v) => s + v.views, 0) / Math.max(1, j.videos.length);
    const linhas = vs.map((v, i) => `${i + 1}. ${curto(v.views)} views · ${curto(v.likes)} curtidas · ${curto(v.comentarios)} coment. · ${(eng(v) * 100).toFixed(1)}% engaj.${v.data ? " · " + new Date(v.data * 1000).toISOString().slice(0, 10) : ""}\n   ${(v.titulo || "").slice(0, 120)}\n   ${v.url}`);
    return texto(`@${j.perfil}: ${j.videos.length} vídeos, média de ${curto(Math.round(media))} views.\n\n${linhas.join("\n")}`);
  }
  if (nome === "legenda_post") {
    const t = String(a.titulo || "").replace(/\*/g, "").trim();
    const frase = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    const tags = (a.hashtags || "#gta6 #gtavi #gta #cortes #gameplay").split(/[\s,]+/).filter(Boolean).slice(0, 5);
    const cta = a.palavra_cta ? `💬 Comenta ${String(a.palavra_cta).toUpperCase()}` : "";
    if (a.rede === "youtube") return texto(`Título: ${frase.slice(0, 88)} #shorts\n\nDescrição:\n${[frase + " 🔥", cta, tags.join(" ")].filter(Boolean).join("\n\n")}`);
    if (a.rede === "tiktok") return texto([frase + " 🔥", cta, [...tags, "#fyp"].join(" ")].filter(Boolean).join(" "));
    return texto([frase + " 🔥", cta, tags.join(" ")].filter(Boolean).join("\n\n"));
  }
  return texto(`Ferramenta desconhecida: ${nome}`, true);
}

async function responder(msg, origem) {
  const { id, method, params } = msg;
  if (id === undefined || id === null) return null; // notificação
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  try {
    if (method === "initialize")
      return ok({
        protocolVersion: params?.protocolVersion || VERSAO_PROTOCOLO,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "cortes", title: "Cortes · estúdio de cortes virais", version: "1.0.0" },
        instructions: "Use radar_tiktok para descobrir vídeos fortes, info_video para conferir um link e abrir_cortes para gerar o link que abre o site já cortando. Para publicar, o usuário usa o Postiz (conector próprio do Postiz).",
      });
    if (method === "ping") return ok({});
    if (method === "tools/list") return ok({ tools: FERRAMENTAS });
    if (method === "tools/call") return ok(await chamar(params?.name, params?.arguments || {}, origem));
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Método não suportado: ${method}` } };
  } catch (e) {
    return ok(texto("Erro: " + (e?.message || e), true));
  }
}

export default async function handler(req) {
  const origem = new URL(req.url).origin;
  const cab = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Authorization", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cab });
  if (req.method !== "POST") return new Response(JSON.stringify({ erro: "Use POST (MCP Streamable HTTP)." }), { status: 405, headers: { ...cab, Allow: "POST" } });
  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido" } }), { status: 400, headers: cab });
  }
  const lote = Array.isArray(corpo);
  const respostas = (await Promise.all((lote ? corpo : [corpo]).map((m) => responder(m, origem)))).filter(Boolean);
  if (!respostas.length) return new Response(null, { status: 202, headers: cab });
  return new Response(JSON.stringify(lote ? respostas : respostas[0]), { status: 200, headers: cab });
}
