// Publicação automática pelo Postiz (Instagram, TikTok, YouTube...).
// Caminho do vídeo: navegador → Vercel Blob (temporário) → Postiz busca pela URL → apagamos do Blob.

const BLOB_CLIENT = "https://cdn.jsdelivr.net/npm/@vercel/blob@2.8.2/client/+esm";

async function postiz(cfg, caminho, metodo = "GET", corpo = null) {
  const r = await fetch("/api/postiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base: cfg.base || undefined, chave: cfg.chave, caminho, metodo, corpo }),
  });
  const txt = await r.text();
  let j;
  try {
    j = JSON.parse(txt);
  } catch {
    j = { msg: txt.slice(0, 200) };
  }
  if (!r.ok) {
    const msg = j.erro || j.msg || j.message || `erro ${r.status}`;
    throw new Error(r.status === 401 ? "Chave do Postiz inválida." : r.status === 429 ? "Limite de pedidos do Postiz por hora atingido. Tente mais tarde." : `Postiz: ${Array.isArray(msg) ? msg.join("; ") : msg}`);
  }
  return j;
}

/** canais conectados no Postiz: [{id, name, identifier, picture, disabled}] */
export async function canais(cfg) {
  const j = await postiz(cfg, "/integrations");
  return (Array.isArray(j) ? j : j.integrations ?? []).filter((c) => !c.disabled);
}

/** qual rede do site cada canal do Postiz atende */
export const redeDoCanal = (c) => {
  const id = (c.identifier || "").toLowerCase();
  if (id.startsWith("instagram")) return "instagram";
  if (id.startsWith("tiktok")) return "tiktok";
  if (id.startsWith("youtube")) return "youtube";
  return null;
};

/** "2026-11-12" "18:30" no fuso -> ISO UTC */
export function isoNoFuso(dia, hora, fuso = "America/Sao_Paulo") {
  const [y, m, d] = dia.split("-").map(Number);
  const [h, mi] = hora.split(":").map(Number);
  const palpite = Date.UTC(y, m - 1, d, h, mi);
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: fuso, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(palpite))
      .map((p) => [p.type, p.value]),
  );
  const comoUTC = Date.UTC(+partes.year, +partes.month - 1, +partes.day, +partes.hour, +partes.minute);
  return new Date(palpite - (comoUTC - palpite)).toISOString();
}

async function subirTemporario(render) {
  const { upload } = await import(BLOB_CLIENT);
  const ext = render.mime?.includes("mp4") ? "mp4" : "webm";
  const r = await upload(`cortes/${render.id}.${ext}`, render.blob, {
    access: "public",
    handleUploadUrl: "/api/midia",
    contentType: ext === "mp4" ? "video/mp4" : "video/webm",
    multipart: render.blob.size > 20e6,
  });
  return r.url;
}

const apagarTemporario = (url) => fetch(`/api/midia?url=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => {});

function configuracoes(canal, post, cfg) {
  const rede = redeDoCanal(canal);
  const tipo = canal.identifier;
  if (rede === "instagram") return { __type: tipo, post_type: "post" };
  if (rede === "tiktok")
    return {
      __type: tipo,
      title: (post.titulo || "").slice(0, 90),
      privacy_level: cfg.tiktokPrivacidade || "PUBLIC_TO_EVERYONE",
      duet: false,
      stitch: false,
      comment: true,
      autoAddMusic: "no",
      brand_content_toggle: false,
      brand_organic_toggle: false,
      content_posting_method: "DIRECT_POST",
    };
  if (rede === "youtube") {
    let t = (post.tituloYt || post.titulo || "Corte").slice(0, 100);
    if (t.length < 2) t = "Corte";
    return { __type: tipo, title: t, type: cfg.youtubeVisibilidade || "public", selfDeclaredMadeForKids: "no" };
  }
  return { __type: tipo };
}

/**
 * Agenda os posts no Postiz. Um pedido por horário (todas as redes juntas) para gastar pouco do limite por hora.
 * posts: saídas de montarAgenda; renders: lista de vídeos; cfg: { chave, base, mapa:{rede: canalId}, fuso, ... }
 * enviados: { [post.id]: info } (já agendados são pulados). log(texto, progresso0a1)
 */
export async function agendar({ posts, renders, cfg, canaisLista, enviados, log = () => {}, cancelar = { valor: false } }) {
  const midia = new Map(); // renderId -> {id, path, blobUrl}
  const pendentes = posts.filter((p) => !enviados[p.id] && cfg.mapa?.[p.rede]);
  const agora = Date.now() + 5 * 60 * 1000;
  const grupos = new Map();
  for (const p of pendentes) {
    const iso = isoNoFuso(p.dia, p.hora, cfg.fuso);
    if (Date.parse(iso) < agora) continue; // horário já passou
    const k = iso;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(p);
  }
  const total = [...grupos.values()].reduce((a, g) => a + g.length, 0);
  if (!total) return { agendados: 0, pulados: pendentes.length };
  let feitos = 0;
  const temporarios = [];
  try {
    for (const [iso, grupo] of grupos) {
      if (cancelar.valor) break;
      const itens = [];
      for (const p of grupo) {
        const canal = canaisLista.find((c) => c.id === cfg.mapa[p.rede]);
        if (!canal) continue;
        if (!midia.has(p.renderId)) {
          const r = renders.find((x) => x.id === p.renderId);
          log(`Enviando o vídeo "${p.titulo}"...`, feitos / total);
          const url = await subirTemporario(r);
          temporarios.push(url);
          const m = await postiz(cfg, "/upload-from-url", "POST", { url });
          midia.set(p.renderId, { id: m.id, path: m.path });
        }
        itens.push({ p, canal, m: midia.get(p.renderId) });
      }
      if (!itens.length) continue;
      log(`Agendando ${itens.length} post(s) para ${new Date(iso).toLocaleString("pt-BR")}...`, feitos / total);
      const resp = await postiz(cfg, "/posts", "POST", {
        type: "schedule",
        date: iso,
        shortLink: false,
        tags: [],
        posts: itens.map(({ p, canal, m }) => ({
          integration: { id: canal.id },
          value: [{ content: p.texto, image: [{ id: m.id, path: m.path }] }],
          settings: configuracoes(canal, p, cfg),
        })),
      });
      for (const { p } of itens) enviados[p.id] = { quando: Date.now(), data: iso, resp: Array.isArray(resp) ? resp.map((x) => x.postId ?? x.id).filter(Boolean) : null };
      feitos += itens.length;
      log(`${feitos} de ${total} agendados`, feitos / total);
    }
  } finally {
    // o Postiz já copiou os vídeos: apaga as cópias temporárias
    for (const u of temporarios) apagarTemporario(u);
  }
  return { agendados: feitos, pulados: pendentes.length - total };
}
