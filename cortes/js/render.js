// Monta e grava cada corte vertical (1080x1920) num <canvas>, em tempo real, com MediaRecorder.
// Tudo acontece no navegador: o vídeo original nunca sai do computador.

export const W = 1080;
export const H = 1920;
const TEASER_S = 1.6;
const LETREIRO_S = 1.4;
const CTA_S = 2.6;

export const TEMAS = {
  neon: { nome: "Neon", primary: "#ff2d8a", accent: "#ffb547", bg: "#1a0b2e" },
  fogo: { nome: "Fogo", primary: "#ff3b30", accent: "#ffd60a", bg: "#1a0505" },
  gelo: { nome: "Gelo", primary: "#22d3ee", accent: "#ffffff", bg: "#06141c" },
  ouro: { nome: "Ouro", primary: "#e8c46a", accent: "#fff1c9", bg: "#0d0a04" },
  verde: { nome: "Verde", primary: "#22c55e", accent: "#facc15", bg: "#04140a" },
};

export const introS = (intro) => ({ teaser: TEASER_S, letreiro: LETREIRO_S })[intro] ?? 0;

/* ------------------------- utilitários ------------------------- */

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOutBack = (x) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};
const easeOut = (x) => 1 - (1 - x) ** 3;
const pop = (dt, d = 0.28) => (dt <= 0 ? 0 : dt >= d ? 1 : easeOutBack(dt / d));
const rand = (s) => {
  const x = Math.sin(s * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

export const parseHL = (s) => {
  const out = [];
  const re = /\*([^*]+)\*/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: s.slice(last, m.index), hl: false });
    out.push({ t: m[1], hl: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: s.slice(last), hl: false });
  return out;
};

/** Quebra um texto com *destaques* em linhas que cabem em maxW */
function linhas(ctx, text, maxW, upper = true) {
  const words = [];
  for (const p of parseHL(text)) for (const w of p.t.split(/\s+/).filter(Boolean)) words.push({ t: upper ? w.toUpperCase() : w, hl: p.hl });
  const space = ctx.measureText(" ").width;
  const out = [];
  let cur = [], cw = 0;
  for (const w of words) {
    const ww = ctx.measureText(w.t).width;
    if (cur.length && cw + space + ww > maxW) {
      out.push({ ws: cur, w: cw });
      cur = [];
      cw = 0;
    }
    cur.push({ ...w, w: ww });
    cw += (cur.length > 1 ? space : 0) + ww;
  }
  if (cur.length) out.push({ ws: cur, w: cw });
  return out;
}

function desenhaLinhas(ctx, ls, { x, y, lh, align = "center", cor = "#fff", corHL = "#ff0", stroke = 0, corStroke = "#000" }) {
  const space = ctx.measureText(" ").width;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ls.forEach((l, i) => {
    let cx = align === "center" ? x - l.w / 2 : x;
    for (const w of l.ws) {
      if (stroke) {
        ctx.lineWidth = stroke;
        ctx.strokeStyle = corStroke;
        ctx.lineJoin = "round";
        ctx.strokeText(w.t, cx, y + i * lh);
      }
      ctx.fillStyle = w.hl ? corHL : cor;
      ctx.fillText(w.t, cx, y + i * lh);
      cx += w.w + space;
    }
  });
}

function ajustaFonte(ctx, text, maxW, maxLines, big, small, weight = 900, family = "Rubik") {
  for (let s = big; s >= small; s -= 4) {
    ctx.font = `${weight} ${s}px ${family}, Arial Black, sans-serif`;
    const ls = linhas(ctx, text, maxW, family === "Rubik");
    if (ls.length <= maxLines) return { size: s, ls };
  }
  ctx.font = `${weight} ${small}px ${family}, Arial Black, sans-serif`;
  return { size: small, ls: linhas(ctx, text, maxW, family === "Rubik") };
}

/** desenha a área `rect` (frações) do vídeo cobrindo a caixa, com zoom e tremida */
function drawCrop(ctx, v, rect, dx, dy, dw, dh, { zoom = 1, shake = [0, 0], filter = null } = {}) {
  const vw = v.videoWidth || 1920, vh = v.videoHeight || 1080;
  const r = rect || { x: 0, y: 0, w: 1, h: 1 };
  let sw = r.w * vw, sh = r.h * vh;
  const cx = (r.x + r.w / 2) * vw, cy = (r.y + r.h / 2) * vh;
  const box = dw / dh;
  if (sw / sh > box) sw = sh * box;
  else sh = sw / box;
  sw /= zoom;
  sh /= zoom;
  const sx = Math.max(0, Math.min(vw - sw, cx - sw / 2));
  const sy = Math.max(0, Math.min(vh - sh, cy - sh / 2));
  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();
  if (filter) ctx.filter = filter;
  try {
    ctx.drawImage(v, sx, sy, sw, sh, dx + shake[0] - (filter ? 40 : 0), dy + shake[1] - (filter ? 40 : 0), dw + (filter ? 80 : 0), dh + (filter ? 80 : 0));
  } catch {}
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r, fill, stroke, lw = 0) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

/* ------------------------- legendas ------------------------- */

function grupos(words) {
  const g = [];
  for (const w of words) {
    const last = g[g.length - 1];
    const chars = last ? last.reduce((a, x) => a + x.text.length, 0) : 0;
    if (!last || last.length >= 3 || chars + w.text.length > 16 || w.start - last[last.length - 1].end > 0.5 || /[.!?]$/.test(last[last.length - 1].text)) g.push([w]);
    else last.push(w);
  }
  return g;
}

function desenhaLegenda(ctx, gs, t, top, tema) {
  const gi = gs.findIndex((g, i) => t >= g[0].start - 0.03 && t < (gs[i + 1]?.[0].start ?? g[g.length - 1].end + 0.6) && t <= Math.min(g[g.length - 1].end + 0.6, g[0].start + 3.5));
  if (gi < 0) return;
  const g = gs[gi];
  const s = pop(t - g[0].start, 0.2);
  ctx.save();
  ctx.translate(W / 2, top + 50);
  ctx.rotate(((rand(gi) - 0.5) * 4 * Math.PI) / 180);
  ctx.scale(0.75 + 0.25 * s, 0.75 + 0.25 * s);
  ctx.font = "900 92px Rubik, Arial Black, sans-serif";
  const ts = g.map((w) => w.text.replace(/^[-–—"“]+/, "").replace(/[,.;"”]+$/, "").toUpperCase());
  const ws = ts.map((x) => ctx.measureText(x).width);
  const gap = 34;
  const total = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
  let scale = total > W - 100 ? (W - 100) / total : 1;
  ctx.scale(scale, scale);
  let x = -total / 2;
  g.forEach((w, i) => {
    const active = t >= w.start && t < (g[i + 1]?.start ?? w.end + 0.3);
    ctx.save();
    ctx.translate(x + ws[i] / 2, 0);
    if (active) ctx.scale(1.12, 1.12);
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    ctx.lineWidth = 16;
    ctx.strokeStyle = "#000";
    ctx.strokeText(ts[i], 0, 0);
    ctx.shadowColor = active ? tema.primary : "transparent";
    ctx.shadowBlur = active ? 30 : 0;
    ctx.fillStyle = active ? tema.accent : "#fff";
    ctx.fillText(ts[i], 0, 0);
    ctx.restore();
    x += ws[i] + gap;
  });
  ctx.restore();
}

/* ------------------------- títulos (templates) ------------------------- */

function tituloPadrao(ctx, c, t, top, tema) {
  const s = pop(t, 0.35);
  const tagS = pop(t - 0.2, 0.3);
  // selos
  ctx.font = "900 34px Rubik, Arial Black, sans-serif";
  const chips = [];
  if (c.tag) chips.push({ txt: `${c.emoji ? c.emoji + " " : ""}${c.tag}`, bg: tema.primary, border: null });
  if (c.parte) chips.push({ txt: `PARTE ${c.parte.n}/${c.parte.total}`, bg: "rgba(0,0,0,.75)", border: "#fff" });
  const cw = chips.map((x) => ctx.measureText(x.txt).width + 44);
  let x = W / 2 - (cw.reduce((a, b) => a + b, 0) + 14 * (chips.length - 1)) / 2;
  ctx.save();
  ctx.translate(W / 2, top + 28);
  ctx.scale(tagS, tagS);
  ctx.translate(-W / 2, -(top + 28));
  chips.forEach((ch, i) => {
    roundRect(ctx, x, top, cw[i], 56, 28, ch.bg, ch.border, 3);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText(ch.txt, x + 22, top + 40);
    x += cw[i] + 14;
  });
  ctx.restore();
  // caixa branca
  const { size, ls } = ajustaFonte(ctx, c.titulo, W - 200, 3, 70, 46);
  const lh = size * 1.1;
  const bw = Math.min(W - 120, Math.max(...ls.map((l) => l.w)) + 68);
  const bh = ls.length * lh + 40;
  const by = top + (chips.length ? 74 : 0);
  ctx.save();
  ctx.translate(W / 2, by + bh / 2);
  ctx.scale(0.5 + 0.5 * s, 0.5 + 0.5 * s);
  ctx.rotate((-1.5 * s * Math.PI) / 180);
  ctx.globalAlpha = clamp01(s * 2);
  roundRect(ctx, -bw / 2, -bh / 2 + 16, bw, bh, 28, "rgba(0,0,0,.35)");
  roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 28, "#fff", tema.primary, 6);
  ctx.font = `900 ${size}px Rubik, Arial Black, sans-serif`;
  desenhaLinhas(ctx, ls, { x: 0, y: -bh / 2 + 20 + size * 0.88, lh, cor: "#111", corHL: tema.primary });
  ctx.restore();
}

function tituloNoticia(ctx, c, t, top, tema, cfg) {
  const s = pop(t, 0.4);
  const y0 = top - 70 - (1 - s) * 60;
  const nome = cfg.pagina || cfg.handle || "Notícias";
  ctx.font = "800 54px Inter, Arial, sans-serif";
  const ls = linhas(ctx, c.titulo, W - 112, false);
  const lh = 64;
  const hgt = 26 + 72 + 20 + ls.length * lh + 30;
  ctx.save();
  ctx.globalAlpha = clamp01(s * 1.5);
  const gr = ctx.createLinearGradient(0, y0, 0, y0 + hgt);
  gr.addColorStop(0, "rgba(0,0,0,.92)");
  gr.addColorStop(1, "rgba(0,0,0,.75)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, y0, W, hgt);
  // avatar
  const ax = 56 + 36, ay = y0 + 26 + 36;
  const ag = ctx.createLinearGradient(ax - 36, ay - 36, ax + 36, ay + 36);
  ag.addColorStop(0, tema.primary);
  ag.addColorStop(1, tema.accent);
  ctx.beginPath();
  ctx.arc(ax, ay, 36, 0, Math.PI * 2);
  ctx.fillStyle = ag;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
  const ini = nome.replace(/[^\p{L}\p{N} ]/gu, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  ctx.fillStyle = "#fff";
  ctx.font = "900 30px Rubik, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(ini, ax, ay + 11);
  ctx.textAlign = "left";
  ctx.font = "700 36px Inter, Arial, sans-serif";
  ctx.fillText(nome, 148, ay - 4);
  const nw = ctx.measureText(nome).width;
  ctx.beginPath();
  ctx.arc(148 + nw + 26, ay - 16, 17, 0, Math.PI * 2);
  ctx.fillStyle = "#3897f0";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "900 22px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✓", 148 + nw + 26, ay - 8);
  ctx.textAlign = "left";
  if (cfg.handle) {
    ctx.font = "500 28px Inter, Arial, sans-serif";
    ctx.fillStyle = "#aaa";
    ctx.fillText(cfg.handle, 148, ay + 32);
  }
  ctx.font = "800 54px Inter, Arial, sans-serif";
  desenhaLinhas(ctx, ls, { x: 56, y: y0 + 26 + 72 + 20 + 48, lh, align: "left", cor: "#fff", corHL: tema.accent });
  ctx.restore();
}

function tituloFaixa(ctx, c, t, top, tema, layout, cfg) {
  const a = easeOut(clamp01(t / 0.4));
  const b = easeOut(clamp01((t - 0.2) / 0.4));
  const blink = Math.floor(t * 2) % 2 === 0;
  ctx.save();
  ctx.font = "900 40px Rubik, Arial Black, sans-serif";
  const tag = (c.tag || "URGENTE").toUpperCase();
  const tw = ctx.measureText(tag).width + 80;
  ctx.translate((1 - a) * -700, 0);
  ctx.transform(1, 0, -0.14, 1, 0, 0);
  ctx.fillStyle = "#e11d2e";
  ctx.fillRect(40 + 30, top, tw, 62);
  ctx.beginPath();
  ctx.arc(40 + 30 + 30, top + 31, 9, 0, Math.PI * 2);
  ctx.fillStyle = blink ? "#fff" : "rgba(255,255,255,.3)";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.fillText(tag, 40 + 30 + 52, top + 46);
  ctx.restore();
  const { size, ls } = ajustaFonte(ctx, c.titulo, W - 136, 3, 60, 44);
  const lh = size * 1.08;
  const bh = ls.length * lh + 40;
  ctx.save();
  ctx.translate((1 - b) * 1100, 0);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fillRect(40, top + 70 + 14, W - 80, bh);
  ctx.fillStyle = "#fff";
  ctx.fillRect(40, top + 70, W - 80, bh);
  ctx.font = `900 ${size}px Rubik, Arial Black, sans-serif`;
  desenhaLinhas(ctx, ls, { x: 68, y: top + 70 + 20 + size * 0.88, lh, align: "left", cor: "#111", corHL: "#e11d2e" });
  ctx.restore();
  if (layout === "blur") {
    const y = 1296;
    ctx.fillStyle = "#111";
    ctx.fillRect(0, y, W, 64);
    ctx.fillStyle = "#e11d2e";
    ctx.fillRect(0, y, W, 4);
    ctx.font = "800 32px Rubik, sans-serif";
    ctx.fillStyle = "#fff";
    const txt = `${tag} • ${c.titulo.replace(/\*/g, "").toUpperCase()} • ${cfg.handle || ""} • `;
    const tw2 = ctx.measureText(txt).width;
    let x = -((t * 180) % tw2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, W, 64);
    ctx.clip();
    while (x < W) {
      ctx.fillText(txt, x, y + 44);
      x += tw2;
    }
    ctx.restore();
  }
}

function tituloMinimal(ctx, c, t, top, tema) {
  const s = pop(t, 0.3);
  const { size, ls } = ajustaFonte(ctx, c.titulo, W - 100, 3, 86, 62);
  ctx.save();
  ctx.translate(W / 2, top + 60);
  ctx.scale(0.6 + 0.4 * s, 0.6 + 0.4 * s);
  ctx.globalAlpha = clamp01(s * 2);
  ctx.font = `900 ${size}px Rubik, Arial Black, sans-serif`;
  desenhaLinhas(ctx, ls, { x: 0, y: 0, lh: size * 1.02, cor: "#fff", corHL: tema.accent, stroke: 14 });
  ctx.restore();
}

/* ------------------------- efeitos ------------------------- */

const zoomAt = (t, picos) => {
  let z = 0;
  for (const p of picos) {
    const d = t - p + 0.12;
    if (d < 0 || d > 1.8) continue;
    z = Math.max(z, d < 0.15 ? d / 0.15 : d < 0.9 ? 1 : 1 - (d - 0.9) / 0.9);
  }
  return z;
};

function faiscas(ctx, t, x, y, tema) {
  if (t < 0 || t > 1.4) return;
  const cores = [tema.primary, tema.accent, "#fff"];
  for (let i = 0; i < 30; i++) {
    const a = rand(i) * Math.PI * 2;
    const v = 240 + rand(i * 3) * 540;
    const px = x + Math.cos(a) * v * t;
    const py = y + Math.sin(a) * v * t + 0.5 * 800 * t * t;
    ctx.globalAlpha = Math.max(0, 1 - t / 1.3);
    ctx.fillStyle = cores[i % 3];
    ctx.beginPath();
    ctx.arc(px, py, 4 + rand(i * 5) * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function desenhaCTA(ctx, t, cta, tema) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(0,0,0,.2)");
  g.addColorStop(0.4, "rgba(0,0,0,.85)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const cy = 980;
  ctx.textAlign = "center";
  const s1 = pop(t, 0.3);
  ctx.save();
  ctx.translate(W / 2, cy - 150);
  ctx.scale(s1, s1);
  ctx.font = "900 80px Rubik, Arial Black, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText((cta.verb || "Comenta").toUpperCase(), 0, 0);
  ctx.restore();
  const word = (cta.word || "").toUpperCase();
  const s2 = pop(t - 0.25, 0.3);
  ctx.save();
  ctx.translate(W / 2, cy + 20);
  ctx.scale(s2, s2);
  const fs = word.length > 8 ? 130 : 180;
  ctx.font = `900 ${fs}px Rubik, Arial Black, sans-serif`;
  const gw = ctx.createLinearGradient(0, -fs, 0, 0);
  gw.addColorStop(0, tema.primary);
  gw.addColorStop(1, tema.accent);
  ctx.lineWidth = 14;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,.6)";
  ctx.strokeText(word, 0, 0);
  ctx.shadowColor = tema.primary;
  ctx.shadowBlur = 40;
  ctx.fillStyle = gw;
  ctx.fillText(word, 0, 0);
  ctx.restore();
  // caixa de comentário digitando
  const s3 = easeOut(clamp01((t - 0.5) / 0.4));
  const y = cy + 90 + (1 - s3) * 300;
  roundRect(ctx, 130, y, 820, 110, 55, "#f7f2fb");
  ctx.beginPath();
  ctx.arc(130 + 60, y + 55, 26, 0, Math.PI * 2);
  ctx.fillStyle = tema.primary;
  ctx.fill();
  const typed = Math.floor(clamp01((t - 0.85) / (word.length * 0.13)) * word.length);
  const sent = t > 0.95 + word.length * 0.13;
  ctx.textAlign = "left";
  ctx.font = "800 46px Rubik, sans-serif";
  ctx.fillStyle = "#222";
  ctx.fillText(word.slice(0, typed) + (!sent && Math.floor(t * 4) % 2 ? "|" : ""), 130 + 106, y + 71);
  const hs = sent ? 0.8 + 0.4 * pop(t - 0.95 - word.length * 0.13, 0.25) : 1;
  ctx.save();
  ctx.translate(130 + 820 - 60, y + 58);
  ctx.scale(hs, hs);
  ctx.textAlign = "center";
  ctx.font = "60px sans-serif";
  ctx.fillStyle = sent ? "#ff3d7f" : "#ccc";
  ctx.fillText("♥", 0, 20);
  ctx.restore();
  if (sent) faiscas(ctx, t - 0.95 - word.length * 0.13, 890, y + 55, tema);
}

function desenhaLetreiro(ctx, t, texto, emoji, tema) {
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const chars = texto.toUpperCase().slice(0, 12).split("");
  const size = chars.length > 8 ? 96 : 130;
  const cw = size * 0.72, chh = size * 1.05, gap = size * 0.12;
  const total = chars.reduce((a, ch) => a + (ch === " " ? size * 0.35 : cw) + gap, -gap);
  const out = clamp01((LETREIRO_S - t) / 0.2);
  ctx.save();
  ctx.globalAlpha = out;
  ctx.translate(W / 2, H / 2 - 60);
  ctx.scale(1 + (1 - out) * 0.3, 1 + (1 - out) * 0.3);
  roundRect(ctx, -total / 2 - 30, -chh / 2 - 30, total + 60, chh + 60, 24, "rgba(10,6,20,.88)", tema.primary, 5);
  ctx.shadowColor = tema.primary;
  ctx.shadowBlur = 40;
  ctx.strokeRect(-total / 2 - 30, -chh / 2 - 30, 0, 0);
  ctx.shadowBlur = 0;
  let x = -total / 2;
  const f = Math.floor(t * 30);
  chars.forEach((ch, i) => {
    if (ch === " ") {
      x += size * 0.35 + gap;
      return;
    }
    const settle = 6 + i * 3;
    const shown = f < settle ? glyphs[(f * 3 + i * 7) % glyphs.length] : ch;
    const g = ctx.createLinearGradient(0, -chh / 2, 0, chh / 2);
    g.addColorStop(0, "#1d1d24");
    g.addColorStop(0.49, "#2a2a33");
    g.addColorStop(0.51, "#111116");
    g.addColorStop(1, "#1c1c22");
    roundRect(ctx, x, -chh / 2, cw, chh, size * 0.08, g);
    ctx.fillStyle = "#f6f6f6";
    ctx.font = `800 ${size * 0.78}px Rubik, monospace`;
    ctx.textAlign = "center";
    ctx.fillText(shown, x + cw / 2, size * 0.28);
    ctx.fillStyle = "rgba(0,0,0,.65)";
    ctx.fillRect(x, -1.5, cw, 3);
    x += cw + gap;
  });
  if (emoji) {
    const s = pop(t - 0.45, 0.3);
    ctx.font = `${140 * s}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(emoji, 0, chh / 2 + 200);
  }
  ctx.restore();
}

/* ------------------------- fundo e moldura (otimizados) ------------------------- */

let mini = null;
/** desfoque barato: desenha o vídeo num canvas de 90x160 e amplia (o borrão sai de graça) */
function fundoDesfocado(ctx, v, rect, brilho = 0.45) {
  if (!mini) {
    mini = document.createElement("canvas");
    mini.width = 54;
    mini.height = 96;
  }
  const m = mini.getContext("2d");
  drawCrop(m, v, rect, 0, 0, mini.width, mini.height, { zoom: 1.15 });
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(mini, -20, -20, W + 40, H + 40);
  ctx.fillStyle = `rgba(0,0,0,${1 - brilho})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

const molduras = new Map();
/** brilho neon em volta da caixa do vídeo, pré-desenhado uma vez por cor */
function molduraNeon(cor) {
  if (molduras.has(cor)) return molduras.get(cor);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = 800 + 140;
  const g = c.getContext("2d");
  g.shadowColor = cor;
  g.shadowBlur = 60;
  g.fillStyle = cor;
  g.fillRect(-6, 70 - 6, W + 12, 812);
  molduras.set(cor, c);
  return c;
}

/* ------------------------- quadro completo ------------------------- */

/**
 * Desenha um quadro.
 * fase: "teaser" | "letreiro" | "main"
 * t: segundos dentro da fase (no "main", tempo dentro do corte)
 */
export function desenhaQuadro(ctx, v, c, cfg, fase, t) {
  const tema = TEMAS[c.tema] ?? TEMAS.neon;
  const layout = c.layout ?? "blur";
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  if (fase === "letreiro") {
    fundoDesfocado(ctx, v, c.jogo, 0.5);
    desenhaLetreiro(ctx, t, c.introTexto || c.tag || "OLHA ISSO", c.emoji, tema);
    return;
  }

  const tt = fase === "teaser" ? (c.picos?.[0] ?? (c.fim - c.inicio) * 0.6) - 1 + t : t;
  const picos = c.picos ?? [];
  const zoom = 1 + 0.28 * zoomAt(tt, picos);
  const passados = picos.filter((p) => p <= tt);
  const ultimo = passados.length ? Math.max(...passados) : null;
  const desde = ultimo != null ? tt - ultimo : 99;
  const amp = desde < 0.35 ? (1 - desde / 0.35) * 14 : 0;
  const shake = [(Math.random() - 0.5) * 2 * amp, (Math.random() - 0.5) * 2 * amp];
  const dur = c.fim - c.inicio;

  if (layout === "split") {
    drawCrop(ctx, v, c.jogo, 0, 0, W, 1010, { zoom, shake });
    drawCrop(ctx, v, c.facecam ?? { x: 0.7, y: 0.65, w: 0.3, h: 0.35 }, 0, 1010, W, 910, { zoom: 1 + 0.12 * zoomAt(tt, picos) });
    ctx.fillStyle = tema.primary;
    ctx.shadowColor = tema.primary;
    ctx.shadowBlur = 30;
    ctx.fillRect(0, 1002, W, 16);
    ctx.shadowBlur = 0;
  } else if (layout === "crop") {
    drawCrop(ctx, v, c.jogo, 0, 0, W, H, { zoom, shake });
  } else {
    fundoDesfocado(ctx, v, c.jogo);
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, tema.bg + "cc");
    gr.addColorStop(0.3, "rgba(0,0,0,0)");
    gr.addColorStop(0.7, "rgba(0,0,0,0)");
    gr.addColorStop(1, tema.bg + "cc");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(molduraNeon(tema.primary), 0, 560 - 70);
    drawCrop(ctx, v, c.jogo, 0, 560, W, 800, { zoom, shake });
  }

  // flash + emoji + faíscas no pico
  if (desde < 0.3) {
    ctx.fillStyle = `rgba(255,255,255,${(1 - desde / 0.3) * 0.45})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (desde < 1.2 && c.emoji) {
    const s = pop(desde, 0.25);
    ctx.save();
    ctx.translate(W - 150, layout === "split" ? 720 : 610);
    ctx.rotate(((12 - desde * 20) * Math.PI) / 180);
    ctx.scale(s, s);
    ctx.font = "150px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(c.emoji, 0, 50);
    ctx.restore();
  }
  faiscas(ctx, desde, W / 2, layout === "split" ? 500 : 960, tema);

  const top = layout === "split" ? 200 : 250;
  const capTop = layout === "split" ? 900 : layout === "crop" ? 1240 : 1420;
  const emCTA = fase === "main" && c.cta && t > dur - CTA_S;

  if (fase === "teaser") {
    ctx.font = "900 56px Rubik, Arial Black, sans-serif";
    const txt = "ESPERA ESSA 👀";
    const w = ctx.measureText(txt).width + 60;
    roundRect(ctx, W / 2 - w / 2, 230, w, 84, 20, "#000", tema.primary, 4);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(txt, W / 2, 292);
    if (t > TEASER_S - 0.3) {
      ctx.fillStyle = "rgba(255,255,255,.12)";
      for (let y = (t * 900) % 9; y < H; y += 9) ctx.fillRect(0, y, W, 3);
      ctx.fillStyle = tema.primary + "40";
      ctx.fillRect(0, 0, W, H);
      ctx.font = "900 130px Rubik, sans-serif";
      ctx.fillStyle = "#ff2a6d";
      ctx.fillText("◀◀", W / 2 + 6, 980);
      ctx.fillStyle = "#05d9e8";
      ctx.fillText("◀◀", W / 2 - 6, 980);
      ctx.fillStyle = "#fff";
      ctx.fillText("◀◀", W / 2, 980);
    }
  } else {
    const tpl = c.template ?? "padrao";
    if (tpl === "noticia") tituloNoticia(ctx, c, t, top, tema, cfg);
    else if (tpl === "faixa") tituloFaixa(ctx, c, t, top, tema, layout, cfg);
    else if (tpl === "minimal") tituloMinimal(ctx, c, t, top, tema);
    else tituloPadrao(ctx, c, t, top, tema);
  }

  if (!emCTA) desenhaLegenda(ctx, c._grupos ?? (c._grupos = grupos(c.words ?? [])), tt, capTop, tema);

  if (cfg.handle && c.template !== "faixa") {
    ctx.font = "800 32px Rubik, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fillText(cfg.handle, W - 40, layout === "blur" ? 1335 : 1730);
  }
  if (fase === "main") {
    const yb = layout === "blur" ? 1360 : layout === "split" ? 1002 : 1904;
    ctx.fillStyle = tema.accent;
    ctx.shadowColor = tema.accent;
    ctx.shadowBlur = 18;
    ctx.fillRect(0, yb, W * clamp01(t / dur), layout === "split" ? 16 : 10);
    ctx.shadowBlur = 0;
  }
  if (emCTA) desenhaCTA(ctx, t - (dur - CTA_S), c.cta, tema);
}

/* ------------------------- gravação ------------------------- */

const esperaSeek = (v, t) =>
  new Promise((res) => {
    const f = () => {
      v.removeEventListener("seeked", f);
      res();
    };
    v.addEventListener("seeked", f);
    v.currentTime = t;
  });

export const formatoSaida = () => {
  const opts = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1.4D401F,mp4a.40.2", "video/mp4;codecs=avc1.42E01F,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4;codecs=avc3,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];
  return opts.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) ?? "video/webm";
};

function sfxBoom(actx, dest) {
  const t0 = actx.currentTime;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(120, t0);
  o.frequency.exponentialRampToValueAtTime(35, t0 + 0.6);
  g.gain.setValueAtTime(0.9, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
  o.connect(g).connect(dest);
  o.start(t0);
  o.stop(t0 + 0.75);
}
function sfxWhoosh(actx, dest) {
  const t0 = actx.currentTime;
  const len = Math.floor(actx.sampleRate * 0.45);
  const b = actx.createBuffer(1, len, actx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len);
  const s = actx.createBufferSource();
  s.buffer = b;
  const f = actx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(400, t0);
  f.frequency.exponentialRampToValueAtTime(3000, t0 + 0.4);
  const g = actx.createGain();
  g.gain.value = 0.5;
  s.connect(f).connect(g).connect(dest);
  s.start(t0);
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Grava uma variação. Retorna { blob, mime }.
 * onProgress(0..1); preview = canvas visível opcional (espelha o quadro)
 */
export async function gravar(file, c, cfg, { onProgress = () => {}, preview = null, cancelar = { valor: false } } = {}) {
  await Promise.all([document.fonts.load("900 80px Rubik"), document.fonts.load("800 50px Inter")]).catch(() => {});
  const v = document.createElement("video");
  v.src = URL.createObjectURL(file);
  v.playsInline = true;
  v.preload = "auto";
  await new Promise((r, j) => {
    v.onloadeddata = r;
    v.onerror = () => j(new Error("Não consegui abrir o vídeo original."));
  });
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const pctx = preview?.getContext("2d");

  const actx = new AudioContext();
  const src = actx.createMediaElementSource(v);
  const comp = actx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.ratio.value = 4;
  const ganho = actx.createGain();
  ganho.gain.value = 1.5;
  const dest = actx.createMediaStreamDestination();
  src.connect(comp).connect(ganho).connect(dest);
  const sfx = actx.createGain();
  sfx.gain.value = 0.8;
  sfx.connect(dest);

  const mime = formatoSaida();
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000, audioBitsPerSecond: 192_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const dur = c.fim - c.inicio;
  const intro = c.intro ?? "nenhuma";
  const total = introS(intro) + dur;
  let fase = intro === "nenhuma" ? "main" : intro;
  let tFase = 0;
  let rodando = true;
  const espelho = () => pctx && pctx.drawImage(canvas, 0, 0, preview.width, preview.height);

  const loop = () => {
    if (!rodando) return;
    desenhaQuadro(ctx, v, c, cfg, fase, fase === "main" ? v.currentTime - c.inicio : tFase);
    espelho();
    requestAnimationFrame(loop);
  };

  try {
    if (actx.state === "suspended") await actx.resume();
    const pico = c.picos?.[0] ?? dur * 0.6;
    if (intro === "teaser") {
      await esperaSeek(v, Math.max(0, c.inicio + pico - 1));
      rec.start(500);
      requestAnimationFrame(loop);
      const t0 = performance.now();
      await v.play();
      while ((tFase = (performance.now() - t0) / 1000) < TEASER_S) {
        if (cancelar.valor) throw new Error("cancelado");
        onProgress(tFase / total);
        await espera(30);
      }
      v.pause();
      rec.pause();
      await esperaSeek(v, c.inicio);
      fase = "main";
      await espera(60);
      rec.resume();
    } else if (intro === "letreiro") {
      await esperaSeek(v, c.inicio + pico);
      rec.start(500);
      requestAnimationFrame(loop);
      sfxWhoosh(actx, sfx);
      const t0 = performance.now();
      while ((tFase = (performance.now() - t0) / 1000) < LETREIRO_S) {
        if (cancelar.valor) throw new Error("cancelado");
        onProgress(tFase / total);
        await espera(30);
      }
      rec.pause();
      await esperaSeek(v, c.inicio);
      fase = "main";
      await espera(60);
      rec.resume();
    } else {
      await esperaSeek(v, c.inicio);
      rec.start(500);
      requestAnimationFrame(loop);
    }
    // corpo do corte
    const tocados = new Set();
    await v.play();
    while (v.currentTime < c.fim && !v.ended) {
      if (cancelar.valor) throw new Error("cancelado");
      const t = v.currentTime - c.inicio;
      for (const p of c.picos ?? []) if (!tocados.has(p) && t >= p - 0.05) {
        tocados.add(p);
        sfxBoom(actx, sfx);
      }
      onProgress((introS(intro) + t) / total);
      await espera(20);
    }
    v.pause();
    await espera(120);
  } finally {
    rodando = false;
    if (rec.state !== "inactive") {
      const parou = new Promise((r) => (rec.onstop = r));
      rec.stop();
      await parou;
    }
    actx.close();
    URL.revokeObjectURL(v.src);
  }
  onProgress(1);
  return { blob: new Blob(chunks, { type: mime.split(";")[0] }), mime };
}

/** Quadro de prévia (sem gravar) */
export async function previa(canvas, file, c, cfg, fase = "main", t = null) {
  await Promise.all([document.fonts.load("900 80px Rubik"), document.fonts.load("800 50px Inter")]).catch(() => {});
  const v = document.createElement("video");
  v.muted = true;
  v.src = URL.createObjectURL(file);
  await new Promise((r) => (v.onloadeddata = r));
  const dur = c.fim - c.inicio;
  const tt = t ?? Math.min(dur - CTA_S - 0.5, (c.picos?.[0] ?? dur * 0.5) + 0.4);
  await esperaSeek(v, c.inicio + tt);
  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  const ctx = off.getContext("2d");
  desenhaQuadro(ctx, v, c, cfg, fase, fase === "main" ? tt : t ?? 0.8);
  canvas.getContext("2d").drawImage(off, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(v.src);
}
