// Foco no Pet — modelo 3 "fim de semana · laboratório" (1080x1920, 30 fps, 24 s)
// Mesma copy do fds.js com uma direção de arte própria da fotografia:
// visor de câmera com autofoco, mesa de revelação, filme 35 mm, folha de contato
// com lupa, carimbos e marcador escrito à mão. Grão de filme e vazamento de luz.
import {
  W, H, FPS, loadAssets as loadBase,
  CREAM, TAU, focus, clamp, lerp, outCubic, inOutCubic, outBack, prog, hash,
  mont, drawCover, rrect, paw, drawLogo,
} from './reel.js';

export { W, H, FPS };
export const NAME = 'fds2';
export const DURATION = 24;
export const S = { hook: 0, vs: 3, how: 9, wall: 13, cta: 17 };

const INK = '#0E0C0A', PAPER = '#F2EBDD', PRINT = '#FBF8F1', SAFE = '#C8261B', MARK = '#E15A0A', FILM = '#1B1511';
const serif = (px, it = false) => `${it ? 'italic ' : ''}${px}px "DM Serif Display", "Noto Color Emoji", serif`;
const mono = (px, w = 400) => `${w} ${px}px "Space Mono", "Noto Color Emoji", monospace`;
const marker = (px) => `${px}px "Permanent Marker", "Noto Color Emoji", cursive`;
const FOC = (n) => ({ hero: [0.5, 0.3], p12: [0.45, 0.3], p13: [0.52, 0.2] })[n] || focus(n);

// ---------- linha do tempo ----------
const PAIRS = [
  { img: 'p12', label: 'tremida', filter: 'blur(8px) saturate(0.75)', ghost: [28, 14] },
  { img: 'p04', label: 'no escuro', filter: 'brightness(0.28) contrast(0.8) saturate(0.4) blur(2px)' },
  { img: 'p01', label: 'cortou a cabeça', filter: 'blur(1.5px) saturate(0.8)', zoom: 1.8, fy: 1, rot: 0.07 },
];
const HOW = [
  ['p04', 'Estúdio montado no parque'],
  ['p03', 'Fundo colorido e luz de estúdio'],
  ['p13', 'Todo porte, toda raça'],
  ['p06', 'Recordação pra vida toda'],
];
const SHEET = ['p13', 'p01', 'p04', 'p02', 'p06', 'p12', 'p09', 'p00', 'p05', 'p10', 'p08', 'p07', 'p11', 'p03', 'hero', null];
const TYPED = Array.from('FDS 🐾');
const T_TYPE = S.cta + 3.35, T_POST = T_TYPE + TYPED.length * 0.17 + 0.25, T_HEART = T_POST + 0.45;
const AF_LOCK = 0.8;

export const CUES = [
  { t: 0.05, type: 'impact' }, { t: 0.3, type: 'tick' }, { t: 0.55, type: 'tick' }, { t: AF_LOCK, type: 'tick' }, { t: AF_LOCK + 0.07, type: 'tick' },
  { t: 1.0, type: 'pop', i: 2 }, { t: 1.3, type: 'pop', i: 4 }, { t: 1.95, type: 'whoosh' }, { t: 1.9, type: 'riser', dur: 1.1 },
  ...PAIRS.flatMap((_, k) => {
    const b = S.vs + k * 2;
    return [{ t: b, type: 'shutter' }, { t: b + 0.45, type: 'whoosh' }, { t: b + 0.8, type: 'stamp' }, { t: b + 1.0, type: 'shutter' }, { t: b + 1.35, type: 'ding' }];
  }),
  { t: S.how, type: 'shutter' },
  ...HOW.flatMap((_, i) => [{ t: S.how + 0.3 + i * 0.75, type: 'tick' }, { t: S.how + 0.3 + i * 0.75 + 0.05, type: 'shutter' }, { t: S.how + 0.62 + i * 0.75, type: 'pop', i }]),
  { t: S.wall - 1.1, type: 'riser', dur: 1.1 }, { t: S.wall, type: 'impact' }, { t: S.wall, type: 'shutter' },
  { t: S.wall + 0.9, type: 'whoosh' }, { t: S.wall + 2.5, type: 'whoosh' }, { t: S.wall + 2.95, type: 'ding' },
  { t: S.cta, type: 'shutter' }, { t: S.cta, type: 'crash', g: 0.6 },
  { t: S.cta + 0.2, type: 'pop', i: 1 }, { t: S.cta + 0.5, type: 'pop', i: 3 },
  { t: S.cta + 0.95, type: 'stamp' }, { t: S.cta + 1.2, type: 'stamp' }, { t: S.cta + 1.75, type: 'whoosh' },
  { t: S.cta + 2.45, type: 'whoosh' }, { t: S.cta + 2.65, type: 'stamp' }, { t: S.cta + 3.0, type: 'whoosh' }, { t: S.cta + 3.1, type: 'pop', i: 5 },
  ...TYPED.map((_, i) => ({ t: T_TYPE + i * 0.17, type: 'tick' })),
  { t: T_POST, type: 'pop', i: 6 }, { t: T_HEART, type: 'ding' }, { t: S.cta + 5.5, type: 'pop', i: 2 },
  { t: DURATION - 0.2, type: 'shutter' },
];
const SHAKES = [[0.05, 18], [S.wall, 16], [S.cta + 0.95, 14], [S.cta + 1.2, 16], [S.cta + 2.65, 12], ...PAIRS.map((_, k) => [S.vs + k * 2 + 0.8, 10])];

function shake(t) {
  let dx = 0, dy = 0;
  for (const [t0, amp] of SHAKES) { const d = t - t0; if (d >= 0 && d < 0.4) { const k = amp * Math.exp(-d * 11); dx += Math.sin(d * 93 + t0) * k; dy += Math.cos(d * 71 + t0) * k; } }
  return { dx, dy };
}

// ---------- texturas e traços à mão ----------
let GRAIN = null;
function grain(ctx, t, alpha = 0.13) {
  if (!GRAIN) {
    GRAIN = document.createElement('canvas'); GRAIN.width = GRAIN.height = 256;
    const g = GRAIN.getContext('2d'), d = g.createImageData(256, 256);
    let s = 99; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (rnd() - 0.5) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
  }
  const f = Math.floor(t * FPS);
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = alpha;
  ctx.translate(-hash(f) * 256, -hash(f + 7) * 256);
  ctx.fillStyle = ctx.createPattern(GRAIN, 'repeat'); ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
}
function lightLeak(ctx, t, a = 0.35) {
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const x = W * (0.5 + 0.6 * Math.sin(t * 0.7)), y = H * (0.15 + 0.1 * Math.cos(t * 0.5));
  const g = ctx.createRadialGradient(x, y, 0, x, y, 900);
  g.addColorStop(0, `rgba(255,120,40,${a})`); g.addColorStop(0.5, `rgba(200,38,27,${a * 0.4})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
// obturador de cortina: a = 0 aberto, 1 fechado
function curtain(ctx, a) {
  if (a <= 0) return;
  const h = (H / 2) * inOutCubic(a);
  ctx.save(); ctx.fillStyle = INK; ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h);
  ctx.fillStyle = MARK; ctx.fillRect(0, h - 4, W, 4); ctx.fillRect(0, H - h, W, 4); ctx.restore();
}
function fitF(ctx, text, make, size, maxW) {
  ctx.font = make(size);
  while (ctx.measureText(text).width > maxW && size > 10) { size -= 2; ctx.font = make(size); }
  return make(size);
}
function txt(ctx, text, x, y, font, color, align = 'center', alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y); ctx.restore();
}
// texto que sobe e aparece
function rise(ctx, text, x, y, font, color, t0, t, align = 'center') {
  const q = prog(t, t0, 0.45); if (q <= 0) return;
  txt(ctx, text, x, y + (1 - outCubic(q)) * 50, font, color, align, outCubic(q));
}
// escrita à mão: revela da esquerda para a direita
function writeOn(ctx, text, x, y, font, color, p, rot = 0, align = 'center') {
  if (p <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.font = font;
  const w = ctx.measureText(text).width, left = align === 'center' ? -w / 2 : 0;
  ctx.beginPath(); ctx.rect(left - 30, -300, (w + 60) * clamp(p), 600); ctx.clip();
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 0);
  ctx.restore();
}
function strokePts(ctx, pts, p, color, width) {
  const n = Math.floor(pts.length * clamp(p)); if (n < 2) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(...pts[0]); for (let i = 1; i < n; i++) ctx.lineTo(...pts[i]); ctx.stroke(); ctx.restore();
}
const circlePts = (cx, cy, rx, ry, seed = 1) => Array.from({ length: 90 }, (_, i) => {
  const a = -2.4 + (i / 89) * TAU * 1.12, k = 1 + 0.05 * Math.sin(a * 3 + seed) + i * 0.0009;
  return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
});
const linePts = (x0, x1, y, seed = 1) => Array.from({ length: 30 }, (_, i) => { const p = i / 29; return [lerp(x0, x1, p), y + Math.sin(p * 7 + seed) * 4 - p * 10]; });
const arrowPts = (x0, y0, x1, y1, bend = 80) => {
  const pts = Array.from({ length: 28 }, (_, i) => { const p = i / 27, mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2; return [(1 - p) ** 2 * x0 + 2 * (1 - p) * p * mx + p * p * x1, (1 - p) ** 2 * y0 + 2 * (1 - p) * p * my + p * p * y1]; });
  const [ax, ay] = pts[pts.length - 3], g = Math.atan2(y1 - ay, x1 - ax);
  return pts.concat([[x1 + Math.cos(g + 2.6) * 40, y1 + Math.sin(g + 2.6) * 40], [x1, y1], [x1 + Math.cos(g - 2.6) * 40, y1 + Math.sin(g - 2.6) * 40]]);
};
function brackets(ctx, x, y, w, h, len, color, lw = 6) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'square';
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx, cy + sy * len); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * len, cy); ctx.stroke();
  }
  ctx.restore();
}
const fitIn = (img, maxW, maxH) => { let h = maxH, w = h * img.width / img.height; if (w > maxW) { w = maxW; h = w * img.height / img.width; } return [w, h]; };

// ---------- 1. visor da câmera com autofoco ----------
function sceneHook(ctx, A, t) {
  const blur = t < AF_LOCK ? [26, 8, 18, 0][Math.min(3, Math.floor(t / 0.2))] * (1 - (t % 0.2) / 0.4) + (t < 0.6 ? 6 : 0) : 0;
  ctx.save(); if (blur > 0.3) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  drawCover(ctx, A.photos.p13, 0, 0, W, H, 1.04 + 0.04 * prog(t, 0, 3), 0.5, 0.2); ctx.restore();
  const g = ctx.createLinearGradient(0, H * 0.48, 0, H);
  g.addColorStop(0, 'rgba(14,12,10,0)'); g.addColorStop(0.45, 'rgba(14,12,10,0.78)'); g.addColorStop(1, 'rgba(14,12,10,0.92)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // grade de terços + marcas de canto + dados do visor
  ctx.save(); ctx.strokeStyle = 'rgba(242,235,221,0.16)'; ctx.lineWidth = 2;
  for (const f of [1 / 3, 2 / 3]) { ctx.beginPath(); ctx.moveTo(W * f, 0); ctx.lineTo(W * f, H); ctx.moveTo(0, H * f); ctx.lineTo(W, H * f); ctx.stroke(); }
  ctx.restore();
  brackets(ctx, 50, 210, W - 100, H - 420, 70, 'rgba(242,235,221,0.75)', 4);
  if (Math.floor(t * 2) % 2 === 0) { ctx.fillStyle = SAFE; ctx.beginPath(); ctx.arc(100, 270, 13, 0, TAU); ctx.fill(); }
  txt(ctx, 'REC', 126, 271, mono(30, 700), PAPER, 'left');
  const fr = Math.floor(t * FPS);
  txt(ctx, `00:00:0${Math.floor(t)}:${String(fr % FPS).padStart(2, '0')}`, W - 90, 271, mono(28), PAPER, 'right');
  txt(ctx, 'ISO 400   1/250   f/2.8', W / 2, 1655, mono(28), 'rgba(242,235,221,0.8)');

  // autofoco procurando e travando no rosto
  const tgt = [585, 400, 380, 400];
  const path = [[540, 900, 560, 560], [380, 600, 420, 420], [700, 520, 400, 400], tgt];
  const k = Math.min(3, Math.floor(t / 0.27)), q = outCubic((t % 0.27) / 0.27);
  const a0 = path[Math.max(0, k - 1)], a1 = path[k], b = t >= AF_LOCK ? tgt : a0.map((v, i) => lerp(v, a1[i], q));
  const locked = t >= AF_LOCK, pop = locked ? 1 + 0.12 * Math.exp(-(t - AF_LOCK) * 10) : 1;
  const [cx, cy, bw, bh] = b;
  brackets(ctx, cx - (bw * pop) / 2, cy - (bh * pop) / 2, bw * pop, bh * pop, 54, locked ? MARK : PAPER, locked ? 8 : 5);
  if (locked) txt(ctx, '● FOCO TRAVADO', cx, cy + (bh * pop) / 2 + 40, mono(26, 700), MARK);

  rise(ctx, 'Seu pet não vai ser', W / 2, 1180, serif(98), PAPER, 1.0, t);
  rise(ctx, 'filhote pra sempre.', W / 2, 1305, serif(124, true), PAPER, 1.3, t);
  writeOn(ctx, '…mas essa foto vai', W / 2 - 30, 1455, marker(64), MARK, prog(t, 1.85, 0.4), -0.03);
  writeOn(ctx, 'durar pra sempre ✨', W / 2 + 20, 1545, marker(64), MARK, prog(t, 2.2, 0.4), -0.03);
  strokePts(ctx, linePts(330, 800, 1592, 2), prog(t, 2.55, 0.25), MARK, 7);
  grain(ctx, t, 0.1);
  curtain(ctx, prog(t, S.vs - 0.22, 0.22));
}

// ---------- 2. mesa de revelação: celular x ensaio ----------
function darkroom(ctx, t) {
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(150, 150, 0, 150, 150, 1400);
  g.addColorStop(0, 'rgba(200,38,27,0.55)'); g.addColorStop(0.6, 'rgba(120,20,12,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function phone(ctx, img, P, cx, cy, rot) {
  const w = 520, h = 1000;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 26;
  ctx.fillStyle = '#050505'; rrect(ctx, -w / 2, -h / 2, w, h, 70); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 4; ctx.stroke();
  ctx.save(); rrect(ctx, -w / 2 + 16, -h / 2 + 16, w - 32, h - 32, 56); ctx.clip();
  ctx.filter = P.filter;
  if (P.rot) ctx.rotate(P.rot);
  drawCover(ctx, img, -w / 2, -h / 2, w, h, P.zoom || 1, 0.5, P.fy ?? 0.4);
  if (P.ghost) { ctx.globalAlpha = 0.5; drawCover(ctx, img, -w / 2 + P.ghost[0], -h / 2 + P.ghost[1], w, h); }
  ctx.restore();
  ctx.fillStyle = '#050505'; rrect(ctx, -70, -h / 2 + 30, 140, 36, 18); ctx.fill();
  txt(ctx, '9:41', -w / 2 + 70, -h / 2 + 48, mont(24, 700), '#fff');
  ctx.restore();
}
function printPhoto(ctx, img, cx, cy, maxW, maxH, rot, sc, caption, capP) {
  const [w, h] = fitIn(img, maxW, maxH), b = 22, bottom = 100;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc);
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
  ctx.fillStyle = PRINT; ctx.fillRect(-w / 2 - b, -h / 2 - b, w + b * 2, h + b + bottom); ctx.shadowColor = 'transparent';
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  if (caption) writeOn(ctx, caption, 0, h / 2 + bottom / 2 + 4, fitF(ctx, caption, marker, 46, w), INK, capP, -0.02);
  ctx.restore();
}
function sceneVs(ctx, A, t) {
  const u = t - S.vs, k = Math.min(PAIRS.length - 1, Math.floor(u / 2)), pu = u - k * 2, P = PAIRS[k], img = A.photos[P.img];
  darkroom(ctx, t);
  txt(ctx, `COMPARATIVO  0${k + 1}/03`, W / 2, 250, mono(26, 700), 'rgba(242,235,221,0.6)');
  txt(ctx, 'Celular vs. Ensaio', W / 2, 335, serif(84, true), PAPER);
  const exit = inOutCubic(prog(pu, 1.82, 0.18));
  ctx.save(); ctx.translate(-exit * 1200, 0);
  const pin = outCubic(prog(pu, 0, 0.3));
  const px = 380, py = 1040 + (1 - pin) * 1200;
  phone(ctx, img, P, px, py, -0.06);
  // legenda escrita à mão + seta
  writeOn(ctx, P.label, 770, 560, fitF(ctx, P.label, marker, 70, 470), MARK, prog(pu, 0.35, 0.35), 0.06);
  strokePts(ctx, arrowPts(760, 620, 590, 760, -60), prog(pu, 0.55, 0.25), MARK, 8);
  // X sobre o celular
  strokePts(ctx, [[px - 230, py - 300], [px + 230, py + 300]], prog(pu, 0.78, 0.1), MARK, 22);
  strokePts(ctx, [[px + 230, py - 300], [px - 230, py + 300]], prog(pu, 0.86, 0.1), MARK, 22);
  // impressão do ensaio cai por cima
  const dq = prog(pu, 1.0, 0.28);
  if (dq > 0) {
    ctx.save(); ctx.globalAlpha = clamp(dq * 3);
    printPhoto(ctx, img, 650, 1060, 600, 800, 0.05, lerp(1.5, 1, outCubic(dq)), 'ensaio Foco no Pet ✓', prog(pu, 1.3, 0.4));
    ctx.restore();
  }
  ctx.restore();
  lightLeak(ctx, t, 0.18);
  grain(ctx, t);
  const fl = pu >= 1.25 ? 1 - prog(pu, 1.25, 0.18) : 0;
  if (fl > 0) { ctx.save(); ctx.globalAlpha = fl * 0.6; ctx.fillStyle = PRINT; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  curtain(ctx, 1 - prog(u, 0, 0.22));
  curtain(ctx, prog(u, S.how - S.vs - 0.22, 0.22));
}

// ---------- 3. filme 35 mm: como funciona ----------
function sceneHow(ctx, A, t) {
  const u = t - S.how;
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  txt(ctx, 'Como funciona?', W / 2, 270, serif(118), INK);
  strokePts(ctx, linePts(250, 830, 345, 3), prog(u, 0.25, 0.3), MARK, 8);
  const pos = -1 + HOW.reduce((s, _, i) => s + inOutCubic(prog(u, 0.3 + i * 0.75, 0.32)), 0);
  const SW = 800, FH = 470, X0 = W / 2 - SW / 2, TOP = 420, CY = 1080;
  ctx.save(); ctx.beginPath(); ctx.rect(0, TOP, W, H - TOP); ctx.clip();
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 40; ctx.fillStyle = FILM; ctx.fillRect(X0, TOP - 40, SW, H); ctx.shadowColor = 'transparent';
  const off = ((-pos * FH) % 64 + 64) % 64;
  ctx.fillStyle = PAPER;
  for (let y = TOP - 64 + off; y < H; y += 64) { rrect(ctx, X0 + 18, y, 26, 36, 6); ctx.fill(); rrect(ctx, X0 + SW - 44, y, 26, 36, 6); ctx.fill(); }
  for (let i = -1; i <= HOW.length; i++) {
    const cy = CY + (i - pos) * FH;
    if (cy < TOP - FH || cy > H + FH) continue;
    txt(ctx, `FOCO NO PET 400  ▸ ${i + 2}A`, X0 + 70, cy - FH / 2 + 26, mono(18, 700), MARK, 'left');
    const wx = X0 + 70, wy = cy - 200, ww = SW - 140, wh = 330;
    ctx.fillStyle = '#000'; ctx.fillRect(wx, wy, ww, wh);
    if (i >= 0 && i < HOW.length) {
      const [n, label] = HOW[i], active = Math.abs(i - pos) < 0.5;
      ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip(); drawCover(ctx, A.photos[n], wx, wy, ww, wh, 1, ...FOC(n)); ctx.restore();
      txt(ctx, `0${i + 1}`, wx, cy + 175, mono(34, 700), MARK, 'left');
      txt(ctx, label, wx + 70, cy + 175, fitF(ctx, label, (px) => mono(px, 700), 34, ww - 70), PAPER, 'left');
      if (!active) { ctx.fillStyle = 'rgba(27,21,17,0.6)'; ctx.fillRect(X0, cy - FH / 2, SW, FH); }
      else {
        const cq = prog(u, 0.62 + i * 0.75, 0.25);
        if (cq > 0) { ctx.save(); ctx.translate(wx + ww - 20, wy + 10); ctx.rotate(0.12); ctx.scale(outBack(cq), outBack(cq)); txt(ctx, '✓', 0, 0, marker(130), MARK); ctx.restore(); }
      }
    }
  }
  ctx.restore();
  grain(ctx, t, 0.09);
  curtain(ctx, 1 - prog(u, 0, 0.22));
  curtain(ctx, prog(u, S.wall - S.how - 0.22, 0.22));
}

// ---------- 4. folha de contato com lupa ----------
const CELL = 240, ROWH = 300, SX = (W - CELL * 4 - 40) / 2, SY = 470;
function cellPos(i) { return [SX + 20 + (i % 4) * CELL + 18, SY + Math.floor(i / 4) * ROWH + 40]; }
function drawSheet(ctx, A, t) {
  for (let r = 0; r < 4; r++) {
    const y = SY + r * ROWH;
    ctx.fillStyle = FILM; ctx.fillRect(SX, y, CELL * 4 + 40, ROWH - 20);
    ctx.fillStyle = 'rgba(242,235,221,0.75)';
    for (let x = SX + 14; x < SX + CELL * 4 + 30; x += 30) { ctx.fillRect(x, y + 10, 14, 16); ctx.fillRect(x, y + ROWH - 46, 14, 16); }
  }
  SHEET.forEach((n, i) => {
    const [x, y] = cellPos(i), s = 204;
    if (n) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip(); drawCover(ctx, A.photos[n], x, y, s, s, 1, ...FOC(n)); ctx.restore(); }
    else {
      ctx.fillStyle = '#2a221c'; ctx.fillRect(x, y, s, s);
      txt(ctx, 'seu pet', x + s / 2, y + s / 2 - 22, marker(36), PAPER);
      txt(ctx, 'aqui?', x + s / 2, y + s / 2 + 24, marker(36), PAPER);
    }
    txt(ctx, `${i + 1} ▸ ${i + 1}A`, x, y + s + 22, mono(16, 700), MARK, 'left');
  });
}
function sceneWall(ctx, A, t) {
  const u = t - S.wall;
  ctx.fillStyle = '#FFFDF7'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1300);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,90,60,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  rise(ctx, 'Seu pet pode ser', W / 2, 250, serif(96), INK, 0.15, u);
  rise(ctx, 'o próximo.', W / 2, 370, serif(136, true), MARK, 0.4, u);
  const sq = outCubic(prog(u, 0, 0.45));
  ctx.save(); ctx.translate(W / 2, 1060 + (1 - sq) * 900); ctx.rotate(-0.025 * sq); ctx.translate(-W / 2, -1060);
  drawSheet(ctx, A, t);
  // marcador circulando o quadro vazio
  const [ex, ey] = cellPos(15);
  strokePts(ctx, circlePts(ex + 102, ey + 102, 150, 140, 4), prog(u, 2.5, 0.45), MARK, 10);
  writeOn(ctx, 'esse!', ex - 70, ey - 70, marker(64), MARK, prog(u, 2.9, 0.3), -0.12);
  ctx.restore();
  // lupa passeando pela folha
  const lq = inOutCubic(prog(u, 0.7, 1.7));
  const lx = lerp(260, 830, lq) + Math.sin(u * 2) * 20, ly = lerp(620, 1350, lq), R = 165;
  if (u > 0.5 && u < 2.6) {
    ctx.save(); ctx.globalAlpha = clamp((u - 0.5) * 4) * clamp((2.6 - u) * 4);
    ctx.save(); ctx.beginPath(); ctx.arc(lx, ly, R, 0, TAU); ctx.clip();
    ctx.fillStyle = '#FFFDF7'; ctx.fillRect(lx - R, ly - R, R * 2, R * 2);
    ctx.translate(lx, ly); ctx.scale(2, 2); ctx.translate(-lx, -ly); ctx.translate(W / 2, 1060); ctx.rotate(-0.025); ctx.translate(-W / 2, -1060);
    drawSheet(ctx, A, t); ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(lx, ly, R, 0, TAU); ctx.stroke();
    ctx.lineWidth = 34; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(lx + R * 0.72, ly + R * 0.72); ctx.lineTo(lx + R * 1.5, ly + R * 1.5); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(lx, ly, R - 22, 3.6, 4.4); ctx.stroke();
    ctx.restore();
  }
  grain(ctx, t, 0.08);
  curtain(ctx, 1 - prog(u, 0, 0.22));
  curtain(ctx, prog(u, S.cta - S.wall - 0.22, 0.22));
}

// ---------- 5. chamada: carimbos, FDS circulado e comentário ----------
function rubberStamp(ctx, text, x, y, rot, t0, u) {
  const q = prog(u, t0, 0.18); if (q <= 0) return;
  const sc = lerp(1.9, 1, outCubic(q));
  ctx.save(); ctx.globalAlpha = clamp(q * 2) * 0.92; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
  ctx.strokeStyle = SAFE; ctx.lineWidth = 10; rrect(ctx, -170, -95, 340, 190, 22); ctx.stroke();
  ctx.lineWidth = 3; rrect(ctx, -152, -77, 304, 154, 14); ctx.stroke();
  txt(ctx, text, 0, 6, mono(118, 700), SAFE);
  ctx.fillStyle = PAPER; // falhas de tinta do carimbo
  for (let i = 0; i < 70; i++) { ctx.beginPath(); ctx.arc((hash(i + t0) - 0.5) * 330, (hash(i * 3 + t0) - 0.5) * 180, 1.5 + hash(i * 7) * 4, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function sceneCta(ctx, A, t) {
  const u = t - S.cta;
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(14,12,10,0.06)'; ctx.lineWidth = 2;
  for (let y = 120; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  const out = inOutCubic(prog(u, 2.25, 0.35));
  if (out < 1) {
    ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(0, -out * 600);
    rise(ctx, 'Esse fim de semana', W / 2, 470, serif(104), INK, 0.2, u);
    rise(ctx, 'tem ensaio.', W / 2, 610, serif(150, true), MARK, 0.5, u);
    rubberStamp(ctx, 'SÁB', 345, 920, -0.12, 0.95, u);
    rubberStamp(ctx, 'DOM', 735, 960, 0.09, 1.2, u);
    writeOn(ctx, 'Quer saber onde?', W / 2 - 40, 1240, marker(84), INK, prog(u, 1.65, 0.45), -0.03);
    const pq = popInQ(u, 2.0);
    if (pq > 0) { ctx.save(); ctx.translate(900, 1215); ctx.scale(pq, pq); txt(ctx, '📍', 0, 0, mont(90), INK); ctx.restore(); }
    ctx.restore();
  }
  if (u >= 2.3) {
    drawLogo(ctx, A, W / 2, 330, 0.3, u - 2.35);
    rise(ctx, 'Comenta', W / 2, 590, serif(132), INK, 2.6, u);
    writeOn(ctx, 'FDS', W / 2, 760, marker(190), MARK, prog(u, 2.85, 0.3), -0.04);
    strokePts(ctx, circlePts(W / 2, 765, 230, 120, 2), prog(u, 3.05, 0.4), MARK, 9);
    // janela de comentários do Instagram
    const sq = outCubic(prog(u, 3.05, 0.4)), top = 990 + (1 - sq) * 950;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 40; ctx.fillStyle = '#121212'; rrect(ctx, 0, top, W, H - top + 60, 44); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#5a5a5a'; rrect(ctx, W / 2 - 50, top + 22, 100, 10, 5); ctx.fill();
    txt(ctx, 'Comentários', W / 2, top + 78, mont(34, 700), '#f5f5f5');
    ctx.fillStyle = '#262626'; ctx.fillRect(0, top + 120, W, 2);
    const posted = t >= T_POST, rowY = top + 210;
    const avatar = (x, y) => { ctx.fillStyle = MARK; ctx.beginPath(); ctx.arc(x, y, 42, 0, TAU); ctx.fill(); paw(ctx, x, y + 3, 0.62, 0, '#fff', 1); };
    if (posted) {
      const pq = outCubic(prog(t, T_POST, 0.3));
      ctx.globalAlpha = pq;
      avatar(90, rowY);
      txt(ctx, 'seu_perfil', 160, rowY - 26, mont(30, 700), '#f5f5f5', 'left'); txt(ctx, 'agora', 330, rowY - 26, mont(28, 500), '#8e8e8e', 'left');
      txt(ctx, 'FDS 🐾', 160, rowY + 22, mont(46, 600), '#f5f5f5', 'left');
      txt(ctx, 'Responder', 160, rowY + 72, mont(26, 600), '#8e8e8e', 'left');
      const hq = prog(t, T_HEART, 0.35), hs = t >= T_HEART ? outBack(hq) : 1;
      ctx.save(); ctx.translate(W - 80, rowY); ctx.scale(hs * 2, hs * 2);
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-18, -4, -12, -20, 0, -10); ctx.bezierCurveTo(12, -20, 18, -4, 0, 8);
      if (t >= T_HEART) { ctx.fillStyle = '#FF3040'; ctx.fill(); } else { ctx.strokeStyle = '#8e8e8e'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    // campo de comentário
    const iy = posted ? top + 520 : top + 210;
    avatar(90, iy);
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 3; rrect(ctx, 160, iy - 46, W - 200, 92, 46); ctx.stroke();
    const n = posted ? 0 : clamp(Math.floor((t - T_TYPE) / 0.17) + 1, 0, TYPED.length), typed = TYPED.slice(0, n).join('');
    if (n === 0 && !posted) txt(ctx, 'Adicione um comentário...', 200, iy, mont(34, 500), '#8e8e8e', 'left');
    else if (n > 0) txt(ctx, typed, 200, iy, mont(40, 600), '#f5f5f5', 'left');
    if (!posted && n > 0 && Math.floor(u * 3) % 2 === 0) { ctx.font = mont(40, 600); ctx.fillStyle = '#4C9AFF'; ctx.fillRect(204 + ctx.measureText(typed).width, iy - 24, 4, 48); }
    txt(ctx, 'Publicar', W - 70, iy, mont(32, 700), n > 0 && !posted ? '#4C9AFF' : '#2b4a6e', 'right');
    ctx.restore();
    // copy final (sobre o papel, acima da janela)
    const cq = prog(u, 5.5, 0.4);
    if (cq > 0) {
      ctx.save(); ctx.globalAlpha = cq;
      txt(ctx, 'que a gente te manda onde vamos estar 📍', W / 2, top + 330 + (1 - outCubic(cq)) * 30, fitF(ctx, 'que a gente te manda onde vamos estar 📍', (px) => mont(px, 700), 36, 960), '#f5f5f5');
      ctx.restore();
    }
    const dq = prog(u, 5.85, 0.4);
    if (dq > 0) {
      ctx.save(); ctx.globalAlpha = dq; const y = top + 420 + (1 - outCubic(dq)) * 30;
      ctx.fillStyle = MARK; rrect(ctx, 110, y - 44, W - 220, 88, 44); ctx.fill();
      txt(ctx, '✈ ou chama no direct pra agendar', W / 2, y + 2, fitF(ctx, '✈ ou chama no direct pra agendar', (px) => mont(px, 800), 38, W - 300), '#fff');
      ctx.restore();
    }
  }
  grain(ctx, t, 0.08);
  curtain(ctx, 1 - prog(u, 0, 0.22));
  curtain(ctx, prog(u, DURATION - S.cta - 0.3, 0.3)); // fecha e emenda no começo (loop)
}
const popInQ = (u, t0) => (u < t0 ? 0 : outBack(prog(u, t0, 0.35)));

export function drawFrame(ctx, t, A) {
  t = clamp(t, 0, DURATION - 1e-6);
  const sh = shake(t);
  ctx.save();
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2 + sh.dx, H / 2 + sh.dy); ctx.scale(1.02, 1.02); ctx.translate(-W / 2, -H / 2);
  if (t < S.vs) sceneHook(ctx, A, t);
  else if (t < S.how) sceneVs(ctx, A, t);
  else if (t < S.wall) sceneHow(ctx, A, t);
  else if (t < S.cta) sceneWall(ctx, A, t);
  else sceneCta(ctx, A, t);
  ctx.restore();
}

export async function loadAssets(base = './assets/') {
  const fonts = [
    new FontFace('DM Serif Display', `url(${base}fonts/dm-serif-display-latin-400-normal.woff2)`),
    new FontFace('DM Serif Display', `url(${base}fonts/dm-serif-display-latin-400-italic.woff2)`, { style: 'italic' }),
    new FontFace('Space Mono', `url(${base}fonts/space-mono-latin-400-normal.woff2)`, { weight: '400' }),
    new FontFace('Space Mono', `url(${base}fonts/space-mono-latin-700-normal.woff2)`, { weight: '700' }),
    new FontFace('Permanent Marker', `url(${base}fonts/permanent-marker-latin-400-normal.woff2)`),
  ];
  const [A] = await Promise.all([loadBase(base), ...fonts.map(async (f) => document.fonts.add(await f.load()))]);
  return A;
}
