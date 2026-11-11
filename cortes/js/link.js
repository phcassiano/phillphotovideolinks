// Vídeo a partir de um link: Twitch/Kick (via /api/resolver) ou link direto (.mp4/.m3u8).
// HLS (.m3u8): baixa os pedaços e monta um MP4 no navegador (mux.js para pedaços .ts).
// Só baixa o trecho necessário: a análise usa uma versão leve, e os cortes buscam só os seus trechos em alta.

const HOSTS_PROXY = [/\.cloudfront\.net$/, /\.ttvnw\.net$/, /\.twitchcdn\.net$/, /\.jtvnw\.net$/, /\.live-video\.net$/, /(^|\.)kick\.com$/];
const viaProxy = (u) => {
  try {
    const h = new URL(u).hostname;
    return HOSTS_PROXY.some((r) => r.test(h)) ? `/api/proxy?u=${encodeURIComponent(u)}` : u;
  } catch {
    return u;
  }
};

const ehDireto = (u) => /\.(mp4|m4v|mov|webm|m3u8)$/i.test(new URL(u).pathname);

/** "1:02:03" | "62:03" | "3723" -> segundos */
export const paraSeg = (s) => {
  if (s == null || String(s).trim() === "") return null;
  const p = String(s).trim().split(":").map(Number);
  if (p.some((x) => !Number.isFinite(x))) return null;
  return p.reduce((a, x) => a * 60 + x, 0);
};

export async function resolver(url) {
  const u = new URL(url);
  if (ehDireto(url)) {
    const nome = decodeURIComponent(u.pathname.split("/").pop() || "video");
    return { titulo: nome, duracao: null, tipo: /\.m3u8/i.test(u.pathname) ? "hls" : "arquivo", variantes: [{ id: "direto", altura: 0, url, hls: /\.m3u8/i.test(u.pathname) }] };
  }
  const r = await fetch(`/api/resolver?url=${encodeURIComponent(url)}`);
  const j = await r.json().catch(() => ({ erro: "O servidor não respondeu direito. Tente de novo." }));
  if (!r.ok || j.erro) throw new Error(j.erro || `Erro ${r.status}`);
  return j;
}

async function baixar(url, { tentativas = 3, tipo = "arraybuffer", onBytes } = {}) {
  let erro;
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(viaProxy(url));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (tipo === "text") return await r.text();
      if (!onBytes || !r.body) return await r.arrayBuffer();
      const reader = r.body.getReader();
      const parts = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        onBytes(value.length);
      }
      return await new Blob(parts).arrayBuffer();
    } catch (e) {
      erro = e;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw new Error(`Falha ao baixar (${erro?.message ?? erro}). Se for um link direto, o site de origem pode não permitir download.`);
}

/* ------------------------- HLS ------------------------- */

function lerPlaylist(txt, base) {
  const linhas = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!linhas[0]?.startsWith("#EXTM3U")) throw new Error("Esse link não é uma playlist de vídeo válida.");
  const abs = (u) => new URL(u, base).href;
  if (linhas.some((l) => l.startsWith("#EXT-X-STREAM-INF"))) {
    const vs = [];
    for (let i = 0; i < linhas.length; i++) {
      if (!linhas[i].startsWith("#EXT-X-STREAM-INF")) continue;
      const res = linhas[i].match(/RESOLUTION=\d+x(\d+)/);
      vs.push({ altura: res ? +res[1] : 0, url: abs(linhas[i + 1]) });
    }
    return { master: true, variantes: vs };
  }
  if (linhas.some((l) => l.startsWith("#EXT-X-KEY") && !/METHOD=NONE/.test(l))) throw new Error("Esse vídeo é protegido (criptografado) e não pode ser baixado.");
  const segs = [];
  let t = 0, dur = 0, mapa = null;
  for (const l of linhas) {
    if (l.startsWith("#EXT-X-MAP")) {
      const m = l.match(/URI="([^"]+)"/);
      if (m) mapa = abs(m[1]);
    } else if (l.startsWith("#EXTINF")) dur = parseFloat(l.slice(8));
    else if (!l.startsWith("#")) {
      segs.push({ url: abs(l), inicio: t, dur });
      t += dur;
    }
  }
  return { master: false, segs, mapa, total: t };
}

async function playlistDeMidia(url, altura) {
  const txt = await baixar(url, { tipo: "text" });
  const pl = lerPlaylist(txt, url);
  if (!pl.master) return pl;
  const vs = pl.variantes.sort((a, b) => a.altura - b.altura);
  const v = altura ? vs.filter((x) => x.altura <= altura).pop() ?? vs[0] : vs[vs.length - 1];
  return playlistDeMidia(v.url);
}

/**
 * Baixa [de, ate] (segundos) de uma playlist HLS e devolve { file, inicio, duracao }.
 * inicio = em que segundo do vídeo original o arquivo começa.
 */
export async function baixarHls(url, { de = null, ate = null, nome = "video", onProgress = () => {}, cancelar = { valor: false } } = {}) {
  const pl = await playlistDeMidia(url);
  if (!pl.segs.length) throw new Error("A playlist está vazia.");
  const a = de ?? 0, b = ate ?? Infinity;
  const segs = pl.segs.filter((s) => s.inicio + s.dur > a && s.inicio < b);
  if (!segs.length) throw new Error("Esse trecho não existe no vídeo (confira o início e o fim).");
  const partes = [];
  let feitos = 0;
  if (pl.mapa) partes.push(await baixar(pl.mapa));
  const ts = !pl.mapa;
  let tm = null, init = false;
  if (ts) {
    if (!window.muxjs) throw new Error("O conversor de vídeo não carregou. Recarregue a página.");
    tm = new window.muxjs.mp4.Transmuxer({ keepOriginalTimestamps: false, remux: true });
    tm.on("data", (seg) => {
      if (!init) {
        partes.push(seg.initSegment.slice());
        init = true;
      }
      partes.push(seg.data.slice());
    });
  }
  // baixa em paralelo (6 por vez), mas monta em ordem
  const bufs = new Array(segs.length);
  let prox = 0, montar = 0;
  const avancar = () => {
    while (montar < segs.length && bufs[montar]) {
      if (ts) {
        tm.push(new Uint8Array(bufs[montar]));
        tm.flush();
      } else partes.push(bufs[montar]);
      bufs[montar] = true;
      montar++;
    }
  };
  const trabalhador = async () => {
    while (prox < segs.length) {
      if (cancelar.valor) throw new Error("cancelado");
      const i = prox++;
      bufs[i] = await baixar(segs[i].url);
      feitos++;
      onProgress(feitos / segs.length);
      avancar();
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, segs.length) }, trabalhador));
  avancar();
  const inicio = segs[0].inicio;
  const fim = segs[segs.length - 1].inicio + segs[segs.length - 1].dur;
  const file = new File(partes, `${nome}.mp4`, { type: "video/mp4" });
  return { file, inicio, duracao: fim - inicio, total: pl.total };
}

/** Baixa um arquivo de vídeo inteiro (link direto) */
export async function baixarArquivo(url, { nome = "video", onProgress = () => {} } = {}) {
  let total = 0, lido = 0;
  try {
    const h = await fetch(viaProxy(url), { method: "HEAD" });
    total = +h.headers.get("content-length") || 0;
  } catch {}
  const buf = await baixar(url, { onBytes: (n) => { lido += n; if (total) onProgress(lido / total); } });
  const tipo = /\.webm/i.test(url) ? "video/webm" : "video/mp4";
  return { file: new File([buf], `${nome}.${tipo === "video/webm" ? "webm" : "mp4"}`, { type: tipo }), inicio: 0, duracao: null };
}

/** escolhe a variante de análise (leve) e a de corte (qualidade escolhida) */
export function escolherVariantes(res, qualidade, duracao) {
  const vs = [...res.variantes].sort((a, b) => a.altura - b.altura);
  if (vs.length === 1) return { analise: vs[0], corte: vs[0] };
  const longo = (duracao ?? res.duracao ?? 0) > 45 * 60;
  const leves = vs.filter((v) => v.altura >= 144);
  const analise = (longo ? leves[0] : leves.filter((v) => v.altura <= 360).pop()) ?? vs[0];
  const corte = vs.filter((v) => v.altura <= qualidade).pop() ?? vs[vs.length - 1];
  return { analise, corte };
}

/* ------------------------- YouTube via Ajudante (no computador do usuário) ------------------------- */

export const AJUDANTE = "http://127.0.0.1:17890";
export const ehYoutube = (url) => {
  try {
    return /(^|\.)(youtube\.com|youtu\.be)$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

export async function ajudanteOnline() {
  try {
    const r = await fetch(`${AJUDANTE}/status`, { signal: AbortSignal.timeout(2000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Pede ao Ajudante para baixar e recebe o arquivo. onProgress(0..1, texto) */
export async function baixarPeloAjudante(url, { qualidade = 720, de = null, ate = null, onProgress = () => {} } = {}) {
  const q = new URLSearchParams({ url, qualidade: String(qualidade) });
  if (de != null) q.set("de", String(de));
  if (ate != null) q.set("ate", String(ate));
  const r = await fetch(`${AJUDANTE}/baixar?${q}`);
  const j = await r.json();
  if (!r.ok) throw new Error(j.erro || "O Ajudante recusou o pedido.");
  let job;
  for (;;) {
    await new Promise((res) => setTimeout(res, 1000));
    job = await (await fetch(`${AJUDANTE}/job?id=${j.id}`)).json();
    if (job.status === "erro") throw new Error(job.erro || "O Ajudante não conseguiu baixar.");
    if (job.status === "pronto") break;
    onProgress(0.85 * (job.prog || 0), `${job.etapa || "baixando"} no seu computador${job.titulo ? `: ${job.titulo}` : ""}`);
  }
  const a = await fetch(`${AJUDANTE}/arquivo?id=${j.id}`);
  if (!a.ok) throw new Error("Não consegui pegar o arquivo do Ajudante.");
  const total = +a.headers.get("content-length") || job.tamanho || 0;
  const reader = a.body.getReader();
  const partes = [];
  let lido = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    partes.push(value);
    lido += value.length;
    if (total) onProgress(0.85 + 0.15 * (lido / total), "passando o vídeo para o site");
  }
  const nome = (job.titulo || "youtube").replace(/[\\/:*?"<>|]+/g, " ").slice(0, 60);
  return { file: new File(partes, `${nome}.mp4`, { type: "video/mp4" }), titulo: job.titulo || "vídeo do YouTube", inicio: job.inicio || 0 };
}
