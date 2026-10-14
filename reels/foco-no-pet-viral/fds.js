// Foco no Pet — modelo 2 "fim de semana" (1080x1920, 30 fps, 24 s)
// Objetivo: converter. Gancho emocional → "celular vs ensaio" → como funciona →
// mural de fotos → chamada com palavra-chave no comentário ("FDS") e direct.
import {
  W, H, FPS, loadAssets,
  ORANGE, ORANGE_D, DARK, CREAM, WHITE, TAU, clamp, lerp, outCubic, inOutCubic, outBack, prog, beatPulse,
  anton, mont, fitFont, drawCover, rrect, flash, iris, paw, floatingPaws, stickerText, pill, popIn, drawLogo,
  orangeBg, darkBg,
} from './reel.js';

export { W, H, FPS, loadAssets };
export const NAME = 'fds';
export const DURATION = 24;
export const S = { hook: 0, vs: 3, how: 9, wall: 13, cta: 17 };

// "Foto de celular" simulada (a mesma foto estragada) x ensaio
const PAIRS = [
  { img: 'p12', label: 'tremida 😵‍💫', filter: 'blur(7px) brightness(0.9) saturate(0.75)', ghost: [26, 12] },
  { img: 'p04', label: 'no escuro 🌑', filter: 'brightness(0.3) contrast(0.8) saturate(0.45) blur(2px)' },
  { img: 'p01', label: 'cortou a cabeça 🙈', filter: 'blur(1.5px) saturate(0.8) brightness(0.9)', zoom: 1.75, fy: 1, rot: 0.06 },
];
const HOW = [
  ['📍', 'Estúdio montado no parque'],
  ['🎨', 'Fundo colorido e luz de estúdio'],
  ['🐾', 'Todo porte, toda raça'],
  ['💛', 'Recordação pra vida toda'],
];
const TYPED = Array.from('FDS 🐾');
const T_TYPE = S.cta + 3.2, T_HEART = T_TYPE + TYPED.length * 0.18 + 0.15;

export const CUES = [
  { t: 0.1, type: 'impact' }, { t: 0.45, type: 'stamp' }, { t: 1.5, type: 'pop', i: 3 },
  { t: 1.9, type: 'riser', dur: 1.1 },
  ...PAIRS.flatMap((_, k) => [
    { t: S.vs + k * 2, type: 'shutter' },
    { t: S.vs + k * 2 + 0.45, type: 'whoosh' },
    { t: S.vs + k * 2 + 1.25, type: 'ding' },
  ]),
  { t: S.how, type: 'whoosh' }, { t: S.how + 0.05, type: 'stamp' },
  ...HOW.map((_, i) => ({ t: S.how + 0.3 + i * 0.75, type: 'pop', i: i + 2 })),
  { t: S.wall - 1.2, type: 'riser', dur: 1.2 }, { t: S.wall, type: 'impact' }, { t: S.wall, type: 'crash', g: 0.7 },
  { t: S.wall + 0.2, type: 'stamp' }, { t: S.wall + 0.5, type: 'stamp' },
  { t: S.cta - 1.2, type: 'riser', dur: 1.2 }, { t: S.cta, type: 'crash', g: 0.8 },
  { t: S.cta + 0.15, type: 'stamp' }, { t: S.cta + 0.45, type: 'stamp' },
  { t: S.cta + 1.0, type: 'pop', i: 4 }, { t: S.cta + 1.2, type: 'pop', i: 6 }, { t: S.cta + 1.6, type: 'stamp' },
  { t: S.cta + 2.45, type: 'whoosh' }, { t: S.cta + 2.7, type: 'stamp' },
  ...TYPED.map((_, i) => ({ t: T_TYPE + i * 0.18, type: 'tick' })),
  { t: T_HEART, type: 'ding' }, { t: S.cta + 4.6, type: 'pop', i: 1 }, { t: S.cta + 5.0, type: 'pop', i: 5 },
];
const SHAKES = [[0.1, 26], [0.45, 30], [S.wall, 22], [S.wall + 0.2, 14], [S.wall + 0.5, 18], [S.cta + 0.15, 10], [S.cta + 0.45, 16], [S.cta + 1.6, 12], [S.cta + 2.7, 16]];

function shake(t) {
  let dx = 0, dy = 0, r = 0;
  for (const [t0, amp] of SHAKES) {
    const d = t - t0;
    if (d >= 0 && d < 0.4) { const k = amp * Math.exp(-d * 11); dx += Math.sin(d * 93 + t0) * k; dy += Math.cos(d * 71 + t0) * k; r += Math.sin(d * 57) * k * 0.0009; }
  }
  return { dx, dy, r };
}

// foto inteira dentro de maxW x maxH
const fit = (img, maxW, maxH) => { let h = maxH, w = h * img.width / img.height; if (w > maxW) { w = maxW; h = w * img.height / img.width; } return [w, h]; };

function slam(ctx, t0, t, x, y, draw, from = 2.6) {
  const q = prog(t, t0, 0.2);
  if (q <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp(q * 2.5); ctx.translate(x, y); const s = lerp(from, 1, outCubic(q)); ctx.scale(s, s); draw(); ctx.restore();
}

function boxedText(ctx, text, size, maxW, fg = WHITE, bg = ORANGE, shadow = ORANGE_D, rot = -0.03) {
  size = fitFont(ctx, text, anton, size, maxW);
  ctx.font = anton(size); const w = ctx.measureText(text).width + 60, h = size * 1.2;
  ctx.rotate(rot); ctx.fillStyle = bg; rrect(ctx, -w / 2, -h / 2, w, h, 18); ctx.fill();
  stickerText(ctx, text, 0, size * 0.04, anton(size), fg, shadow, 8);
}

// ---------- 1. gancho emocional ----------
function sceneHook(ctx, A, t) {
  const z = t < 0.25 ? lerp(1.3, 1, outCubic(t / 0.25)) : 1 + 0.06 * prog(t, 0.25, 2.75);
  drawCover(ctx, A.photos.p13, 0, 0, W, H, z, 0.5, 0.22);
  const g = ctx.createLinearGradient(0, H * 0.45, 0, H);
  g.addColorStop(0, 'rgba(14,14,13,0)'); g.addColorStop(0.5, 'rgba(14,14,13,0.7)'); g.addColorStop(1, 'rgba(14,14,13,0.88)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  slam(ctx, 0.1, t, W / 2, 1180, () => { const s = fitFont(ctx, 'SEU PET NÃO VAI SER', anton, 128, 900); stickerText(ctx, 'SEU PET NÃO VAI SER', 0, 0, anton(s), WHITE, DARK, 9); });
  slam(ctx, 0.45, t, W / 2, 1345, () => boxedText(ctx, 'FILHOTE PRA SEMPRE 🥺', 132, 880));
  const p = popIn(ctx, 1.5, t, 0.45);
  if (p.a > 0) {
    const txt = '…mas essa foto vai durar pra sempre ✨', s = fitFont(ctx, txt, (px) => mont(px, 900), 46, 900);
    ctx.save(); ctx.globalAlpha = p.a; pill(ctx, txt, W / 2, 1530, mont(s, 900), WHITE, DARK, 40, 26, p.s); ctx.restore();
  }
  flash(ctx, t >= 0.45 ? 0.85 * (1 - prog(t, 0.45, 0.12)) : 0, ORANGE);
  iris(ctx, prog(t, S.vs - 0.28, 0.28));
}

// ---------- 2. celular x ensaio (comparador deslizante) ----------
function sceneVs(ctx, A, t) {
  const u = t - S.vs, k = Math.min(PAIRS.length - 1, Math.floor(u / 2)), pu = u - k * 2, P = PAIRS[k], img = A.photos[P.img];
  darkBg(ctx, t);
  const r = inOutCubic(prog(pu, 0.45, 0.8));
  // cabeçalho: CELULAR vs ENSAIO
  const hp = popIn(ctx, 0.05, u, 0.4);
  ctx.save(); ctx.globalAlpha = hp.a;
  pill(ctx, 'CELULAR 😩', 300, 255, mont(44, 900), r < 0.5 ? '#5a5a57' : '#2b2b29', r < 0.5 ? WHITE : '#8a8a86', 36, 24, hp.s * (r < 0.5 ? 1.06 : 0.94));
  pill(ctx, 'ENSAIO ✨', 790, 255, mont(44, 900), r >= 0.5 ? ORANGE : '#2b2b29', r >= 0.5 ? WHITE : '#8a8a86', 36, 24, hp.s * (r >= 0.5 ? 1.08 : 0.94));
  stickerText(ctx, 'VS', 548, 258, anton(64), ORANGE, null);
  ctx.restore();

  const [w, h] = fit(img, 840, 1120);
  const enter = outCubic(prog(pu, 0, 0.28)), cx = W / 2 + (1 - enter) * 900, cy = 960, x0 = cx - w / 2, y0 = cy - h / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
  ctx.fillStyle = WHITE; rrect(ctx, x0 - 16, y0 - 16, w + 32, h + 32, 26); ctx.fill(); ctx.shadowColor = 'transparent';
  rrect(ctx, x0, y0, w, h, 14); ctx.clip();
  // "foto de celular"
  ctx.save(); ctx.filter = P.filter;
  if (P.rot) { ctx.translate(cx, cy); ctx.rotate(P.rot); ctx.translate(-cx, -cy); }
  drawCover(ctx, img, x0 - 20, y0 - 20, w + 40, h + 40, P.zoom || 1, 0.5, P.fy ?? 0.5);
  if (P.ghost) { ctx.globalAlpha = 0.5; drawCover(ctx, img, x0 - 20 + P.ghost[0], y0 - 20 + P.ghost[1], w + 40, h + 40); }
  ctx.restore();
  // ensaio revelado pela direita
  const sx = lerp(x0 + w, x0, r);
  ctx.save(); ctx.beginPath(); ctx.rect(sx, y0, x0 + w - sx, h); ctx.clip(); ctx.drawImage(img, x0, y0, w, h); ctx.restore();
  ctx.restore();
  // etiquetas
  ctx.save(); ctx.globalAlpha = enter * (1 - r);
  pill(ctx, P.label, W / 2, y0 + 70, mont(40, 800), 'rgba(20,20,20,0.85)', WHITE, 30, 20);
  ctx.restore();
  const lp = popIn(ctx, 1.2, pu, 0.4);
  if (lp.a > 0) { ctx.save(); ctx.globalAlpha = lp.a; pill(ctx, 'ENSAIO FOCO NO PET ✨', W / 2, y0 + h - 70, mont(42, 900), ORANGE, WHITE, 34, 22, lp.s); ctx.restore(); }
  // controle deslizante
  if (pu > 0.3 && pu < 1.4) {
    ctx.save(); ctx.fillStyle = WHITE; ctx.fillRect(sx - 4, y0 - 16, 8, h + 32);
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(sx, cy, 46, 0, TAU); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = DARK; ctx.font = mont(40, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('‹ ›', sx, cy + 2);
    ctx.restore();
  }
  // brilho quando revela
  flash(ctx, pu >= 1.25 ? 0.35 * (1 - prog(pu, 1.25, 0.25)) : 0);
  flash(ctx, k > 0 ? 0.6 * (1 - prog(pu, 0, 0.12)) : 0);
  iris(ctx, 1 - prog(u, 0, 0.28));
}

// ---------- 3. como funciona ----------
function sceneHow(ctx, A, t) {
  const u = t - S.how;
  orangeBg(ctx, t);
  const tp = popIn(ctx, 0.05, u, 0.4);
  ctx.save(); ctx.globalAlpha = tp.a; ctx.translate(W / 2, 330); ctx.scale(tp.s, tp.s);
  stickerText(ctx, 'COMO FUNCIONA? 👇', 0, 0, anton(fitFont(ctx, 'COMO FUNCIONA? 👇', anton, 130, 960)), WHITE, DARK, 9); ctx.restore();
  HOW.forEach(([icon, text], i) => {
    const q = prog(u, 0.3 + i * 0.75, 0.42);
    if (q <= 0) return;
    const y = 600 + i * 215, off = (1 - outBack(q)) * 900, bump = 1 + 0.04 * beatPulse(t - i * 0.12) * (u > 3.4 ? 1 : 0);
    ctx.save(); ctx.translate(W / 2 + off, y); ctx.scale(bump, bump);
    ctx.shadowColor = 'rgba(60,20,0,0.35)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
    ctx.fillStyle = WHITE; rrect(ctx, -470, -82, 940, 164, 34); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(-375, 0, 62, 0, TAU); ctx.fill();
    ctx.font = mont(60, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, -375, 4);
    const s = fitFont(ctx, text, (px) => mont(px, 900), 48, 650);
    ctx.fillStyle = DARK; ctx.font = mont(s, 900); ctx.textAlign = 'left'; ctx.fillText(text, -285, 4);
    ctx.restore();
  });
  flash(ctx, 0.85 * (1 - prog(u, 0, 0.14)));
}

// ---------- 4. mural rolando ----------
const ALL = ['p13', 'p01', 'p04', 'p02', 'p06', 'p12', 'p09', 'p00', 'p05', 'p10', 'p08', 'p07', 'p11', 'p03'];
function sceneWall(ctx, A, t) {
  const u = t - S.wall, CW = 330, GAP = 20;
  ctx.fillStyle = '#141413'; ctx.fillRect(0, 0, W, H);
  [0, 1, 2].forEach((c) => {
    const names = ALL.slice(c * 5).concat(ALL.slice(0, c * 5));
    const hs = names.map((n) => CW * A.photos[n].height / A.photos[n].width + GAP), total = hs.reduce((a, b) => a + b, 0);
    const speed = [420, 560, 470][c], dir = c === 1 ? 1 : -1;
    let y = ((((dir * speed * u + c * 300) % total) + total) % total) - total;
    const x = 30 + c * (CW + 15);
    while (y < H) {
      names.forEach((n, i) => {
        const hh = hs[i] - GAP;
        if (y + hh > -50 && y < H + 50) {
          ctx.save(); rrect(ctx, x, y, CW, hh, 18); ctx.clip(); ctx.drawImage(A.photos[n], x, y, CW, hh); ctx.restore();
        }
        y += hs[i];
      });
    }
  });
  ctx.fillStyle = 'rgba(10,10,10,0.5)'; ctx.fillRect(0, 0, W, H);
  const pulse = 1 + 0.05 * beatPulse(t);
  slam(ctx, 0.2, u, W / 2, 850, () => { ctx.scale(pulse, pulse); stickerText(ctx, 'SEU PET PODE SER', 0, 0, anton(124), WHITE, DARK, 9); });
  slam(ctx, 0.5, u, W / 2, 1030, () => { ctx.scale(pulse, pulse); boxedText(ctx, 'O PRÓXIMO 📸', 180, 900); });
  flash(ctx, 0.9 * (1 - prog(u, 0, 0.14)));
}

// ---------- 5. chamada: fim de semana + comenta FDS ----------
function calendar(ctx, x, y, label, t0, u, rot) {
  const p = popIn(ctx, t0, u, 0.4);
  if (p.a <= 0) return;
  ctx.save(); ctx.globalAlpha = p.a; ctx.translate(x, y); ctx.rotate(rot * (2 - outCubic(p.q))); ctx.scale(p.s, p.s);
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
  ctx.fillStyle = WHITE; rrect(ctx, -140, -150, 280, 300, 30); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); rrect(ctx, -140, -150, 280, 300, 30); ctx.clip(); ctx.fillStyle = ORANGE; ctx.fillRect(-140, -150, 280, 80); ctx.restore();
  ctx.fillStyle = WHITE; [-70, 70].forEach((rx) => { ctx.beginPath(); ctx.arc(rx, -110, 12, 0, TAU); ctx.fill(); });
  stickerText(ctx, label, 0, 50, anton(130), DARK, null);
  ctx.restore();
}

function sceneCta(ctx, A, t) {
  const u = t - S.cta;
  ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, 700, 50, W / 2, 700, 1100);
  g.addColorStop(0, 'rgba(225,90,10,0.22)'); g.addColorStop(1, 'rgba(225,90,10,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  floatingPaws(ctx, t, ORANGE, 0.1, 12);

  // parte 1: "esse fim de semana tem ensaio — quer saber onde?"
  const out = inOutCubic(prog(u, 2.3, 0.35));
  if (out < 1) {
    ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(0, -out * 500);
    slam(ctx, 0.15, u, W / 2, 470, () => stickerText(ctx, 'ESSE FIM DE SEMANA', 0, 0, anton(118), DARK, null), 2);
    slam(ctx, 0.45, u, W / 2, 640, () => boxedText(ctx, 'TEM ENSAIO 📸', 170, 900), 2.2);
    calendar(ctx, 380, 960, 'SÁB', 1.0, u, -0.06);
    calendar(ctx, 700, 960, 'DOM', 1.2, u, 0.06);
    slam(ctx, 1.6, u, W / 2, 1290, () => boxedText(ctx, 'QUER SABER ONDE? 📍', 120, 940, WHITE, DARK, '#000', 0.02), 2.4);
    ctx.restore();
  }

  // parte 2: comenta FDS
  if (u >= 2.4) {
    drawLogo(ctx, A, W / 2, 380, 0.34, u - 2.45);
    slam(ctx, 2.7, u, W / 2, 760, () => stickerText(ctx, 'COMENTA 👇', 0, 0, anton(190), DARK, ORANGE, 10), 2.2);
    const cp = popIn(ctx, 2.9, u, 0.4);
    if (cp.a > 0) {
      ctx.save(); ctx.globalAlpha = cp.a; ctx.translate(W / 2, 1040); ctx.scale(cp.s, cp.s);
      ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
      ctx.fillStyle = WHITE; rrect(ctx, -460, -110, 920, 220, 44); ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(-355, 0, 62, 0, TAU); ctx.fill();
      paw(ctx, -355, 4, 0.95, 0, WHITE, 1);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#8a8a86'; ctx.font = mont(32, 800); ctx.fillText('seu_perfil · agora', -265, -48);
      const n = clamp(Math.floor((t - T_TYPE) / 0.18) + 1, 0, TYPED.length);
      const typed = TYPED.slice(0, n).join('');
      ctx.fillStyle = DARK; ctx.font = mont(72, 900); ctx.fillText(typed, -265, 28);
      if (n < TYPED.length || Math.floor(u * 3) % 2 === 0) { const cw = ctx.measureText(typed).width; ctx.fillStyle = ORANGE; ctx.fillRect(-265 + cw + 6, -6, 6, 66); }
      // coração
      const hq = prog(t, T_HEART, 0.35), hs = t >= T_HEART ? outBack(hq) * (1 + 0.1 * beatPulse(t)) : 0.9;
      ctx.save(); ctx.translate(375, 10); ctx.scale(hs * 2.2, hs * 2.2);
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-18, -4, -12, -20, 0, -10); ctx.bezierCurveTo(12, -20, 18, -4, 0, 8);
      if (t >= T_HEART) { ctx.fillStyle = '#ED2E4B'; ctx.fill(); } else { ctx.strokeStyle = '#8a8a86'; ctx.lineWidth = 2.5; ctx.stroke(); }
      ctx.restore();
      ctx.restore();
    }
    const l1 = prog(u, 4.6, 0.4);
    if (l1 > 0) {
      ctx.save(); ctx.globalAlpha = l1; ctx.translate(0, (1 - outCubic(l1)) * 40);
      stickerText(ctx, 'que a gente te manda ONDE', W / 2, 1265, mont(52, 900), DARK, null);
      stickerText(ctx, 'vamos estar no fds 📍', W / 2, 1335, mont(52, 900), DARK, null);
      ctx.restore();
    }
    const l2 = popIn(ctx, 5.0, u, 0.42);
    if (l2.a > 0) {
      ctx.save(); ctx.globalAlpha = l2.a;
      pill(ctx, '📲 ou chama no DIRECT pra agendar', W / 2, 1490, mont(fitFont(ctx, '📲 ou chama no DIRECT pra agendar', (px) => mont(px, 900), 46, 880), 900), ORANGE, WHITE, 40, 28, l2.s * (1 + 0.05 * beatPulse(t)));
      ctx.restore();
    }
  }
  flash(ctx, 0.8 * (1 - prog(u, 0, 0.14)));
  iris(ctx, prog(u, DURATION - S.cta - 0.4, 0.4)); // fecha e emenda no começo (loop)
}

export function drawFrame(ctx, t, A) {
  t = clamp(t, 0, DURATION - 1e-6);
  const sh = shake(t);
  ctx.save();
  ctx.fillStyle = '#0E0E0D'; ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2 + sh.dx, H / 2 + sh.dy); ctx.rotate(sh.r); ctx.scale(1.03, 1.03); ctx.translate(-W / 2, -H / 2);
  if (t < S.vs) sceneHook(ctx, A, t);
  else if (t < S.how) sceneVs(ctx, A, t);
  else if (t < S.wall) sceneHow(ctx, A, t);
  else if (t < S.cta) sceneWall(ctx, A, t);
  else sceneCta(ctx, A, t);
  ctx.restore();
}
