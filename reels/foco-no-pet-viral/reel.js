// Foco no Pet — Reels viral (1080x1920, 30 fps, 25 s)
// Motor de motion graphics em Canvas 2D. drawFrame(ctx, t, A) é determinístico:
// o mesmo t sempre gera o mesmo quadro, então o preview e o render batem 100%.
// Nada aqui toca no DOM no carregamento do módulo, assim o music.js (Node)
// importa a mesma linha do tempo e a trilha fica sincronizada com os cortes.

export const W = 1080, H = 1920, FPS = 30, BPM = 120, BEAT = 60 / BPM, DURATION = 27;

// Cenas (segundos)
export const S = { hook: 0, cards: 2.5, rush: 12.5, grid: 14.5, end: 20.5 };

const ORANGE = '#E15A0A', ORANGE_D = '#B9470A', DARK = '#1E1E1C', CREAM = '#FFF4EA', WHITE = '#FFFFFF';
const TAU = Math.PI * 2;

// 10 fotos "personalidade", uma por segundo (2 batidas)
export const CARDS = [
  { img: 'p01', word: 'ESTILOSO', emoji: '😎' },
  { img: 'p00', word: 'MODO FÉRIAS', emoji: '🌴' },
  { img: 'p02', word: 'SORRISÃO', emoji: '😁' },
  { img: 'p12', word: 'OLHAR DE CINEMA', emoji: '🎬' },
  { img: 'p04', word: 'CARISMA', emoji: '✨' },
  { img: 'p05', word: 'SOLTA A VOZ', emoji: '🎤' },
  { img: 'p06', word: 'FOFURA 100%', emoji: '🥹' },
  { img: 'p09', word: 'TOCA AQUI', emoji: '🙌' },
  { img: 'p13', word: 'POSE DE CAPA', emoji: '📸' },
  { img: 'p10', word: 'LINGUINHA', emoji: '😛' },
];
// Sequência rápida, meia batida cada
export const RUSH = ['p03', 'p12', 'p07', 'p08', 'p13', 'p11', 'p05', 'p02'];
// Grade "qual é o seu favorito?" (números 1..12)
export const GRID = ['p01', 'p04', 'p02', 'p06', 'p09', 'p00', 'p05', 'p12', 'p13', 'p10', 'p08', 'p07'];
const PICK = 6;
// Onde fica o rosto em cada foto (0..1). O enquadramento nunca corta essa região.
const FOCUS = {
  p00: [0.28, 0.43], p01: [0.67, 0.4], p02: [0.6, 0.34], p03: [0.48, 0.43], p04: [0.63, 0.55], p05: [0.33, 0.28],
  p06: [0.44, 0.46], p07: [0.48, 0.55], p08: [0.74, 0.46], p09: [0.52, 0.43], p10: [0.52, 0.4], p11: [0.41, 0.49],
  p12: [0.45, 0.35], p13: [0.52, 0.25],
};
const focus = (name) => FOCUS[name] || [0.5, 0.4]; // onde a roleta para (Nº 7)

// Roleta: batidas que desaceleram até parar no PICK
export const ROULETTE = (() => {
  const ticks = [];
  let t = S.grid + 2.1, dt = 0.07, prev = -1, seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  while (t < S.grid + 3.95) {
    let i;
    do { i = Math.floor(rnd() * 12); } while (i === prev);
    ticks.push({ t, i });
    prev = i; t += dt; dt *= 1.13;
  }
  ticks[ticks.length - 1].i = PICK;
  return ticks;
})();

// Momentos de impacto (tremida de câmera + sons)
const STAMPS = [0.08, 0.34, 0.6];
export const CUES = [
  ...STAMPS.map((t, i) => ({ t, type: i === 0 ? 'impact' : 'stamp' })),
  { t: 1.15, type: 'whoosh' },
  ...CARDS.map((_, k) => ({ t: S.cards + k + 0.2, type: 'shutter' })),
  ...RUSH.map((_, k) => ({ t: S.rush + k * 0.25, type: 'shutter' })),
  ...GRID.map((_, i) => ({ t: S.grid + 0.05 + i * 0.055, type: 'pop', i })),
  ...ROULETTE.map((r) => ({ t: r.t, type: 'tick' })),
  { t: ROULETTE[ROULETTE.length - 1].t + 0.02, type: 'ding' },
  { t: S.grid + 5.3, type: 'whoosh' },
  { t: S.end + 2.3, type: 'stamp' },
  { t: S.end + 2.55, type: 'stamp' },
  { t: S.end + 2.9, type: 'pop', i: 6 },
];
const SHAKES = [
  [STAMPS[0], 26], [STAMPS[1], 20], [STAMPS[2], 34],
  ...CARDS.map((_, k) => [S.cards + k + 0.2, 16]),
  [S.rush, 18], [S.rush + 0.5, 18], [S.grid, 22], [S.end + 2.3, 12], [S.end + 2.55, 16],
];

// ---------- utilidades ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, p) => a + (b - a) * p;
const outCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);
const inCubic = (t) => Math.pow(clamp(t), 3);
const inOutCubic = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const outBack = (t) => { t = clamp(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const prog = (t, start, dur) => clamp((t - start) / dur);
const beatPulse = (t, k = 7) => Math.exp(-((((t % BEAT) + BEAT) % BEAT)) * k);
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const anton = (px) => `${px}px Anton, "Noto Color Emoji", sans-serif`;
const mont = (px, w = 900) => `${w} ${px}px Montserrat, "Noto Color Emoji", sans-serif`;

function fitFont(ctx, text, make, size, maxW) {
  ctx.font = make(size);
  while (ctx.measureText(text).width > maxW && size > 10) { size -= 4; ctx.font = make(size); }
  return size;
}

function drawCover(ctx, img, x, y, w, h, zoom = 1, fx = 0.5, fy = 0.5) {
  const s = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh);
}

function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

function shake(t) {
  let dx = 0, dy = 0, r = 0;
  for (const [t0, amp] of SHAKES) {
    const d = t - t0;
    if (d >= 0 && d < 0.4) {
      const k = amp * Math.exp(-d * 11);
      dx += Math.sin(d * 93 + t0) * k; dy += Math.cos(d * 71 + t0) * k; r += Math.sin(d * 57) * k * 0.0009;
    }
  }
  return { dx, dy, r };
}

function flash(ctx, a, color = WHITE) {
  if (a <= 0.003) return;
  ctx.save(); ctx.globalAlpha = clamp(a); ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.restore();
}

// Íris de obturador (transição da marca): a = 0 aberta, 1 fechada
function iris(ctx, a) {
  if (a <= 0) return;
  const R = (1 - inOutCubic(a)) * 1250, rot = a * 1.4, cx = W / 2, cy = H / 2;
  const v = [];
  for (let i = 0; i < 6; i++) { const g = rot + (i * TAU) / 6; v.push([cx + Math.cos(g) * R, cy + Math.sin(g) * R]); }
  ctx.save();
  ctx.fillStyle = '#0E0E0D';
  ctx.beginPath(); ctx.rect(0, 0, W, H);
  v.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 4;
  for (let i = 0; i < 6; i++) {
    const [x0, y0] = v[i], [x1, y1] = v[(i + 1) % 6];
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + (dx / L) * 2400, y1 + (dy / L) * 2400); ctx.stroke();
  }
  ctx.restore();
}

function paw(ctx, x, y, s, rot, color, alpha) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(0, 14, 27, 23, 0, 0, TAU); ctx.fill();
  for (const [a, b, rx, ry, r] of [[-31, -13, 10, 13, -0.45], [-11, -31, 10, 14, -0.12], [11, -31, 10, 14, 0.12], [31, -13, 10, 13, 0.45]]) {
    ctx.beginPath(); ctx.ellipse(a, b, rx, ry, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function floatingPaws(ctx, t, color, alpha, n = 14) {
  for (let i = 0; i < n; i++) {
    const sp = 60 + hash(i) * 90;
    const y = H + 120 - ((t * sp + hash(i + 9) * (H + 240)) % (H + 240));
    const x = hash(i + 3) * W + Math.sin(t * 1.3 + i) * 30;
    paw(ctx, x, y, 0.8 + hash(i + 5) * 1.6, Math.sin(t + i) * 0.5, color, alpha);
  }
}

// Texto com sombra "sticker": camada escura deslocada + preenchimento
function stickerText(ctx, text, x, y, font, fill, shadow = DARK, off = 8, align = 'center') {
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (shadow) { ctx.fillStyle = shadow; ctx.fillText(text, x + off * 0.7, y + off); }
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

// Letras caindo uma a uma
function staggerText(ctx, text, cx, y, font, fill, shadow, p, step = 0.035) {
  ctx.font = font; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const chars = Array.from(text);
  const total = ctx.measureText(text).width;
  let x = cx - total / 2, acc = '';
  chars.forEach((ch, i) => {
    const before = ctx.measureText(acc).width; acc += ch;
    const q = clamp((p - i * step) / 0.22);
    if (q <= 0) return;
    const yy = y + (1 - outBack(q)) * 90, sc = lerp(1.6, 1, outCubic(q));
    ctx.save(); ctx.globalAlpha = clamp(q * 2);
    const cw = ctx.measureText(ch).width, px = x + before + cw / 2;
    ctx.translate(px, yy); ctx.scale(sc, sc); ctx.textAlign = 'center';
    if (shadow) { ctx.fillStyle = shadow; ctx.fillText(ch, 6, 9); }
    ctx.fillStyle = fill; ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
}

function pill(ctx, text, cx, cy, font, bg, fg, padX = 44, padY = 26, scale = 1) {
  ctx.font = font;
  const w = ctx.measureText(text).width + padX * 2, h = parseInt(font.match(/(\d+)px/)[1], 10) + padY * 2;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale);
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
  ctx.fillStyle = bg; rrect(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 3);
  ctx.restore();
}

function popIn(ctx, t0, t, dur = 0.42) {
  const q = prog(t, t0, dur);
  return { q, s: Math.max(0.001, outBack(q)), a: clamp(q * 3) };
}

// ---------- logo animada (mesmas coordenadas da arte original) ----------
const GRP = [627, 613], AP = [626, 521], TXT0 = [115, 912];
function drawLogo(ctx, A, cx, cy, s, t) {
  if (t <= 0) return;
  const ax = cx + (AP[0] - GRP[0]) * s, ay = cy + (AP[1] - GRP[1]) * s;
  const ap = A.logo.aperture, pw = A.logo.paw, tx = A.logo.text;
  const pa = Math.max(0.001, outBack(t / 0.7));
  ctx.save(); ctx.globalAlpha = outCubic(t / 0.3);
  ctx.translate(ax, ay); ctx.rotate((200 * Math.PI / 180) * (1 - outCubic(t / 0.8)));
  ctx.drawImage(ap, (-ap.width / 2) * s * pa, (-ap.height / 2) * s * pa, ap.width * s * pa, ap.height * s * pa);
  ctx.restore();
  const tp = t - 0.45;
  if (tp > 0) {
    const k = Math.max(0.001, outBack(tp / 0.45)) * s;
    ctx.drawImage(pw, ax - (pw.width / 2) * k, ay - (pw.height / 2) * k, pw.width * k, pw.height * k);
  }
  const tt = t - 0.85;
  if (tt > 0) {
    const e = outCubic(tt / 0.5), sw = tx.width * e;
    if (sw > 1) ctx.drawImage(tx, 0, 0, sw, tx.height, cx + (TXT0[0] - GRP[0]) * s, cy + (TXT0[1] - GRP[1]) * s + (1 - e) * 30, sw * s, tx.height * s);
  }
}

function badge(ctx, A, t) {
  const { s, a } = popIn(ctx, S.cards + 0.3, t);
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(130, 250); ctx.scale(s, s);
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
  ctx.fillStyle = WHITE; rrect(ctx, -75, -68, 150, 136, 28); ctx.fill(); ctx.shadowColor = 'transparent';
  const lf = A.logo.full, k = 128 / lf.width;
  ctx.drawImage(lf, (-lf.width * k) / 2, (-lf.height * k) / 2, lf.width * k, lf.height * k);
  ctx.restore();
}

// ---------- cena 1: gancho ----------
function sceneHook(ctx, A, t) {
  const z = t < 0.22 ? lerp(1.45, 1.14, outCubic(t / 0.22)) : 1.14 - 0.07 * prog(t, 0.22, 2.3);
  drawCover(ctx, A.photos.hero, 0, 0, W, H, z, 0.5, 0.36);
  const g = ctx.createLinearGradient(0, H * 0.5, 0, H);
  g.addColorStop(0, 'rgba(14,14,13,0)'); g.addColorStop(0.55, 'rgba(14,14,13,0.72)'); g.addColorStop(1, 'rgba(14,14,13,0.85)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // "ISSO NÃO É IA." palavra por palavra
  const words = [['ISSO', WHITE], ['NÃO É', WHITE], ['IA.', WHITE]];
  ctx.font = anton(158);
  const gap = 30, widths = words.map(([w]) => ctx.measureText(w).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * 2;
  let x = W / 2 - total / 2;
  const y = 1300;
  words.forEach(([w], i) => {
    const q = prog(t, STAMPS[i], 0.2);
    if (q > 0) {
      const sc = lerp(3.2, 1, outCubic(q)), cx = x + widths[i] / 2;
      ctx.save(); ctx.globalAlpha = clamp(q * 2.5); ctx.translate(cx, y); ctx.scale(sc, sc);
      if (i === 2) { // caixa laranja atrás do "IA."
        const bx = widths[i] / 2 + 22;
        ctx.rotate(-0.04); ctx.fillStyle = ORANGE; rrect(ctx, -bx, -95, bx * 2, 180, 18); ctx.fill();
      }
      stickerText(ctx, w, 0, 4, anton(158), WHITE, i === 2 ? ORANGE_D : DARK, 9);
      ctx.restore();
    }
    x += widths[i] + gap;
  });

  // risco vermelho de "proibido IA" passando pelo IA
  const ps = prog(t, 0.82, 0.18);
  if (ps > 0) {
    const ix = W / 2 + total / 2 - widths[2] / 2;
    ctx.save(); ctx.strokeStyle = WHITE; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ix - 110, y + 70); ctx.lineTo(ix - 110 + 220 * outCubic(ps), y + 70 - 150 * outCubic(ps)); ctx.stroke();
    ctx.restore();
  }

  const p2 = popIn(ctx, 1.15, t, 0.45);
  if (p2.a > 0) {
    ctx.save(); ctx.globalAlpha = p2.a;
    pill(ctx, 'São fotos REAIS do seu pet 📸', W / 2, 1480, mont(50, 900), WHITE, DARK, 44, 26, p2.s);
    ctx.restore();
  }
  const p3 = prog(t, 1.6, 0.4);
  if (p3 > 0) {
    ctx.save(); ctx.globalAlpha = p3;
    stickerText(ctx, 'espera até o final 👀', W / 2, 1600 + (1 - outCubic(p3)) * 30, mont(40, 800), CREAM, null);
    ctx.restore();
  }
  flash(ctx, 0.9 * (1 - prog(t, STAMPS[2], 0.12)) * (t >= STAMPS[2] ? 1 : 0), ORANGE);
}

// ---------- fundo laranja com listras e letreiro ----------
function orangeBg(ctx, t) {
  ctx.fillStyle = ORANGE; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.5);
  ctx.fillStyle = 'rgba(160,55,0,0.28)';
  const off = (t * 120) % 200;
  for (let x = -1600; x < 1600; x += 200) ctx.fillRect(x + off, -1600, 90, 3200);
  ctx.restore();
  ctx.save(); ctx.font = anton(230); ctx.textBaseline = 'middle'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  const line = 'FOCO NO PET • FOCO NO PET • FOCO NO PET • ';
  const lw = ctx.measureText('FOCO NO PET • ').width;
  for (let r = 0; r < 8; r++) {
    const dir = r % 2 ? 1 : -1, sp = 90 + r * 10;
    const x = ((dir * t * sp) % lw) - lw;
    ctx.strokeText(line, x, 120 + r * 250);
  }
  ctx.restore();
  const g = ctx.createRadialGradient(W / 2, 900, 0, W / 2, 900, 900);
  g.addColorStop(0, `rgba(255,220,180,${0.32 * beatPulse(t)})`); g.addColorStop(1, 'rgba(255,220,180,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ---------- cena 2: polaroids empilhando ----------
const CARD_Y = 850, BORDER = 18;
function cardSize(img) { // foto inteira dentro de 860x940
  let h = 940, w = h * img.width / img.height;
  if (w > 860) { w = 860; h = w * img.height / img.width; }
  return [w + BORDER * 2, h + BORDER * 2];
}
const DIRS = [[-1, 0.2], [1, -0.1], [0, 1], [-0.6, -1], [1, 0.5], [-1, -0.4], [0.3, 1], [1, -0.8], [-1, 0.6], [0.5, -1]];
function cardPose(k) {
  return { x: W / 2 + (hash(k + 1) - 0.5) * 50, y: CARD_Y + (hash(k + 2) - 0.5) * 40, r: (k % 2 ? 1 : -1) * (0.035 + hash(k + 4) * 0.03) };
}
function polaroid(ctx, img, x, y, rot, sc, zoom, dim, f = [0.5, 0.4]) {
  const [CARD_W, CARD_H] = cardSize(img);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
  ctx.shadowColor = 'rgba(40,10,0,0.5)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 26;
  ctx.fillStyle = WHITE; rrect(ctx, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 22); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save(); rrect(ctx, -CARD_W / 2 + 18, -CARD_H / 2 + 18, CARD_W - 36, CARD_H - 36, 12); ctx.clip();
  drawCover(ctx, img, -CARD_W / 2 + 18, -CARD_H / 2 + 18, CARD_W - 36, CARD_H - 36, zoom, f[0], f[1]);
  if (dim > 0) { ctx.fillStyle = `rgba(20,8,0,${dim})`; ctx.fillRect(-CARD_W, -CARD_H, CARD_W * 2, CARD_H * 2); }
  ctx.restore(); ctx.restore();
}

function sceneCards(ctx, A, t) {
  const u = t - S.cards;
  orangeBg(ctx, t);
  const k = Math.min(CARDS.length - 1, Math.floor(u));
  for (let j = Math.max(0, k - 2); j <= k; j++) {
    const pose = cardPose(j), img = A.photos[CARDS[j].img], f = focus(CARDS[j].img);
    const age = u - j;
    if (j < k) {
      polaroid(ctx, img, pose.x, pose.y, pose.r, 1 - 0.035 * (k - j), 1, 0.18 * (k - j), f);
    } else {
      const q = prog(age, 0, 0.22), e = outCubic(q), [dx, dy] = DIRS[j % DIRS.length];
      const x = pose.x + dx * (1 - e) * 1400, y = pose.y + dy * (1 - e) * 1700;
      const sc = lerp(1.35, 1, e) * (q >= 1 ? 1 + 0.035 * Math.exp(-(age - 0.22) * 9) : 1);
      if (q < 1) { // rastro de movimento
        for (let g = 3; g >= 1; g--) {
          const eg = outCubic(prog(age - g * 0.025, 0, 0.22));
          ctx.save(); ctx.globalAlpha = 0.12;
          polaroid(ctx, img, pose.x + dx * (1 - eg) * 1400, pose.y + dy * (1 - eg) * 1700, pose.r * 3, lerp(1.35, 1, eg), 1, 0, f);
          ctx.restore();
        }
      }
      polaroid(ctx, img, x, y, lerp(pose.r * 3, pose.r, e), sc, 1 + 0.04 * prog(age, 0, 1), 0, f);
      // flash de câmera no pouso
      const fl = 1 - prog(age, 0.2, 0.18);
      if (age >= 0.2 && fl > 0) {
        const [CARD_W, CARD_H] = cardSize(img);
        ctx.save(); ctx.globalAlpha = fl * 0.85; ctx.translate(x, y); ctx.rotate(pose.r);
        ctx.fillStyle = WHITE; rrect(ctx, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 22); ctx.fill(); ctx.restore();
      }
    }
  }
  // palavra da personalidade
  const c = CARDS[k], age = u - k;
  const txt = `${c.word} ${c.emoji}`;
  const size = fitFont(ctx, txt, anton, 160, 960);
  staggerText(ctx, txt, W / 2, 1440, anton(size), WHITE, DARK, age - 0.16);
  // contador
  const cnt = `${String(k + 1).padStart(2, '0')}/${String(CARDS.length).padStart(2, '0')}`;
  pill(ctx, cnt, 945, 250, mont(40, 900), DARK, WHITE, 30, 20, 1 + 0.12 * Math.exp(-age * 10));
  badge(ctx, A, t);
  iris(ctx, 1 - prog(u, 0, 0.28));
  flash(ctx, 0.9 * (1 - prog(u, 0, 0.15)));
}

// ---------- cena 3: sequência rápida ----------
function sceneRush(ctx, A, t) {
  const u = t - S.rush, i = Math.min(RUSH.length - 1, Math.floor(u / 0.25)), ph = u - i * 0.25;
  if (u < 1.75) {
    // fundo: a mesma foto desfocada; na frente, a foto inteira numa moldura
    const img = A.photos[RUSH[i]], e = outCubic(ph / 0.25);
    ctx.save(); ctx.filter = 'blur(38px) saturate(1.2)'; drawCover(ctx, img, -60, -60, W + 120, H + 120, lerp(1.12, 1.04, e)); ctx.restore();
    if (i % 2) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(225,90,10,0.55)'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    ctx.fillStyle = 'rgba(10,10,10,0.3)'; ctx.fillRect(0, 0, W, H);
    const phh = Math.min(940, 760 * img.height / img.width), pw = phh * img.width / img.height, sc = lerp(1.1, 1, e), rot = (i % 2 ? 1 : -1) * 0.025 * (1 - e);
    ctx.save(); ctx.translate(W / 2, 900); ctx.rotate(rot); ctx.scale(sc, sc);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
    ctx.fillStyle = WHITE; rrect(ctx, -pw / 2 - 16, -phh / 2 - 16, pw + 32, phh + 32, 22); ctx.fill();
    ctx.shadowColor = 'transparent';
    rrect(ctx, -pw / 2, -phh / 2, pw, phh, 12); ctx.clip();
    ctx.drawImage(img, -pw / 2, -phh / 2, pw, phh);
    ctx.restore();
    // moldura que pisca na batida
    ctx.save(); ctx.strokeStyle = i % 2 ? WHITE : ORANGE; ctx.lineWidth = 34 * Math.exp(-ph * 9) + 6; ctx.strokeRect(0, 0, W, H); ctx.restore();
  } else {
    ctx.fillStyle = '#0E0E0D'; ctx.fillRect(0, 0, W, H);
  }
  const pulse = 1 + 0.07 * Math.exp(-ph * 10);
  const a1 = popIn(ctx, 0, u, 0.3), a2 = popIn(ctx, 0.5, u, 0.3);
  if (u < 1.75 && a1.a > 0) {
    ctx.save(); ctx.globalAlpha = a1.a; ctx.translate(W / 2, 290); ctx.scale(a1.s * pulse, a1.s * pulse);
    stickerText(ctx, 'CADA PET', 0, 0, anton(180), WHITE, DARK, 10); ctx.restore();
  }
  if (a2.a > 0) {
    const zoom = u >= 1.75 ? 1 + 0.5 * outCubic(prog(u, 1.75, 0.25)) : 1;
    ctx.save(); ctx.globalAlpha = a2.a; ctx.translate(W / 2, u >= 1.75 ? 960 : 1565); ctx.scale(a2.s * pulse * zoom, a2.s * pulse * zoom); ctx.rotate(-0.03);
    ctx.font = anton(210); const w = ctx.measureText('É ÚNICO').width + 70;
    ctx.fillStyle = ORANGE; rrect(ctx, -w / 2, -125, w * outCubic(prog(u, 0.5, 0.2)), 240, 20); ctx.fill();
    stickerText(ctx, 'É ÚNICO', 0, 6, anton(210), WHITE, ORANGE_D, 10); ctx.restore();
  }
  flash(ctx, 0.8 * (1 - prog(u, 0, 0.12)));
}

// ---------- cena 4: grade "qual é o seu favorito?" ----------
const TW = 236, TH = Math.round(236 * 1290 / 1080), TG = 18, GX = (W - (TW * 4 + TG * 3)) / 2, GY = 480;
function tileRect(i) { return [GX + (i % 4) * (TW + TG), GY + Math.floor(i / 4) * (TH + TG), TW, TH]; }

function darkBg(ctx, t) {
  ctx.fillStyle = '#141413'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, 1000, 50, W / 2, 1000, 1100);
  g.addColorStop(0, 'rgba(225,90,10,0.45)'); g.addColorStop(1, 'rgba(225,90,10,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  floatingPaws(ctx, t, ORANGE, 0.14);
}

function sceneGrid(ctx, A, t) {
  const u = t - S.grid;
  darkBg(ctx, t);
  let hl = -1, done = false;
  for (const r of ROULETTE) if (t >= r.t) hl = r.i;
  const last = ROULETTE[ROULETTE.length - 1].t;
  if (t >= last) done = true;
  const zoomQ = inOutCubic(prog(u, 5.3, 0.55));

  // título (troca depois da roleta)
  const flip = prog(u, 4.15, 0.3);
  const ty = 285;
  if (flip < 0.5) {
    const a = popIn(ctx, 0.1, u, 0.4), sy = flip > 0 ? 1 - flip * 2 : 1;
    ctx.save(); ctx.globalAlpha = a.a; ctx.translate(W / 2, ty); ctx.scale(a.s, a.s * Math.max(0.001, sy));
    stickerText(ctx, 'QUAL É O SEU', 0, -60, anton(100), WHITE, ORANGE_D, 7);
    stickerText(ctx, 'FAVORITO?', 0, 62, anton(150), ORANGE, DARK, 9);
    ctx.restore();
  } else {
    const sy = (flip - 0.5) * 2;
    ctx.save(); ctx.translate(W / 2, ty); ctx.scale(1, Math.max(0.001, sy));
    stickerText(ctx, 'DIFÍCIL ESCOLHER,', 0, -60, anton(100), WHITE, ORANGE_D, 7);
    stickerText(ctx, 'NÉ? 😅', 0, 62, anton(150), ORANGE, DARK, 9);
    ctx.restore();
  }

  GRID.forEach((name, i) => {
    if (zoomQ > 0 && i === PICK) return;
    const [x, y, w, h] = tileRect(i);
    const a = popIn(ctx, 0.05 + i * 0.055, u, 0.4);
    if (a.a <= 0) return;
    let s = a.s, dim = 0;
    if (hl >= 0) { s *= hl === i ? (done ? 1.1 + 0.04 * Math.sin(u * 14) : 1.08) : 1; dim = hl === i ? 0 : 0.55; }
    ctx.save(); ctx.globalAlpha = a.a * (1 - zoomQ); ctx.translate(x + w / 2, y + h / 2); ctx.scale(s, s); ctx.rotate((1 - outCubic(a.q)) * 0.4);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
    ctx.fillStyle = hl === i ? WHITE : '#2a2a28'; rrect(ctx, -w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 20); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save(); rrect(ctx, -w / 2, -h / 2, w, h, 16); ctx.clip();
    drawCover(ctx, A.photos[name], -w / 2, -h / 2, w, h, 1, ...focus(name));
    if (dim) { ctx.fillStyle = `rgba(10,10,10,${dim})`; ctx.fillRect(-w / 2, -h / 2, w, h); }
    ctx.restore();
    const b = popIn(ctx, 0.8 + i * 0.03, u, 0.35);
    if (b.a > 0) {
      ctx.save(); ctx.translate(-w / 2 + 40, -h / 2 + 40); ctx.scale(b.s, b.s);
      ctx.fillStyle = hl === i ? ORANGE : DARK; ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
      ctx.strokeStyle = WHITE; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = WHITE; ctx.font = mont(36, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), 0, 2);
      ctx.restore();
    }
    ctx.restore();
  });

  // CTA de comentário
  const c = popIn(ctx, 1.2, u, 0.45);
  if (c.a > 0 && zoomQ < 1) {
    ctx.save(); ctx.globalAlpha = c.a * (1 - zoomQ);
    const bob = Math.sin(u * Math.PI * 2) * 8;
    pill(ctx, 'COMENTA O NÚMERO 👇', W / 2, 1500 + bob, mont(48, 900), ORANGE, WHITE, 46, 28, c.s * (1 + 0.05 * beatPulse(t)));
    ctx.restore();
  }

  // a foto escolhida cresce até a tela cheia
  if (zoomQ > 0) {
    const [x, y, w, h] = tileRect(PICK);
    const fh = W * 1290 / 1080, rx = lerp(x, 0, zoomQ), ry = lerp(y, (H - fh) / 2, zoomQ), rw = lerp(w, W, zoomQ), rh = lerp(h, fh, zoomQ);
    ctx.save(); rrect(ctx, rx, ry, rw, rh, lerp(16, 0, zoomQ)); ctx.clip();
    drawCover(ctx, A.photos[GRID[PICK]], rx, ry, rw, rh, 1, ...focus(GRID[PICK])); ctx.restore();
  }
  flash(ctx, 0.9 * (1 - prog(u, 0, 0.14)));
  flash(ctx, 0.5 * (done ? 1 - prog(t, last, 0.2) : 0), ORANGE);
  iris(ctx, prog(u, 5.75, 0.25));
}

// ---------- cena 5: logo + chamadas ----------
function sceneEnd(ctx, A, t) {
  const u = t - S.end;
  ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, 520, 50, W / 2, 520, 1000);
  g.addColorStop(0, 'rgba(225,90,10,0.22)'); g.addColorStop(1, 'rgba(225,90,10,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  floatingPaws(ctx, t, ORANGE, 0.1, 12);

  const mv = outCubic(prog(u, 1.9, 0.6));
  drawLogo(ctx, A, W / 2, lerp(860, 520, mv), lerp(0.66, 0.46, mv), u - 0.15);

  const l1 = popIn(ctx, 2.3, u, 0.35), l2 = popIn(ctx, 2.55, u, 0.4);
  if (l1.a > 0) { ctx.save(); ctx.globalAlpha = l1.a; ctx.translate(W / 2, 1000); ctx.scale(l1.s, l1.s); stickerText(ctx, 'AGENDE O ENSAIO', 0, 0, anton(118), DARK, null); ctx.restore(); }
  if (l2.a > 0) {
    ctx.save(); ctx.globalAlpha = l2.a; ctx.translate(W / 2, 1150); ctx.scale(l2.s, l2.s); ctx.rotate(-0.025);
    stickerText(ctx, 'DO SEU PET', 0, 0, anton(180), ORANGE, DARK, 10); ctx.restore();
  }
  const l3 = popIn(ctx, 2.9, u, 0.42);
  if (l3.a > 0) {
    ctx.save(); ctx.globalAlpha = l3.a;
    pill(ctx, '📸  LINK NA BIO', W / 2, 1345, mont(56, 900), DARK, WHITE, 52, 30, l3.s * (1 + 0.06 * beatPulse(t)));
    ctx.restore();
  }
  const l4 = prog(u, 3.35, 0.45);
  if (l4 > 0) {
    ctx.save(); ctx.globalAlpha = l4;
    stickerText(ctx, 'Marca quem tem um pet assim 🐾', W / 2, 1480 + (1 - outCubic(l4)) * 40, mont(44, 800), DARK, null);
    ctx.restore();
  }
  // pata carimbando no final
  const st = popIn(ctx, 3.8, u, 0.3);
  if (st.a > 0) paw(ctx, 960, 1290, 1.2 * st.s, 0.45, ORANGE, 0.9 * st.a);

  iris(ctx, 1 - prog(u, 0, 0.3));
  flash(ctx, 0.7 * (1 - prog(u, 0.0, 0.15)));
  iris(ctx, prog(u, DURATION - S.end - 0.4, 0.4)); // fecha e emenda no começo (loop)
}

// ---------- API pública ----------
export function drawFrame(ctx, t, A) {
  t = clamp(t, 0, DURATION - 1e-6);
  const sh = shake(t);
  ctx.save();
  ctx.fillStyle = '#0E0E0D'; ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2 + sh.dx, H / 2 + sh.dy); ctx.rotate(sh.r); ctx.scale(1.03, 1.03); ctx.translate(-W / 2, -H / 2);
  if (t < S.cards) {
    sceneHook(ctx, A, t);
    iris(ctx, prog(t, S.cards - 0.28, 0.28));
  } else if (t < S.rush) sceneCards(ctx, A, t);
  else if (t < S.grid) sceneRush(ctx, A, t);
  else if (t < S.end) sceneGrid(ctx, A, t);
  else sceneEnd(ctx, A, t);
  ctx.restore();
}

export async function loadAssets(base = './assets/') {
  const fonts = [
    new FontFace('Anton', `url(${base}fonts/anton-latin-400-normal.woff2)`),
    new FontFace('Montserrat', `url(${base}fonts/montserrat-latin-700-normal.woff2)`, { weight: '700' }),
    new FontFace('Montserrat', `url(${base}fonts/montserrat-latin-800-normal.woff2)`, { weight: '800' }),
    new FontFace('Montserrat', `url(${base}fonts/montserrat-latin-900-normal.woff2)`, { weight: '900' }),
  ];
  await Promise.all(fonts.map(async (f) => document.fonts.add(await f.load())));
  const img = (src) => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => err(new Error(src)); i.src = src; });
  const names = ['hero', ...Array.from({ length: 14 }, (_, i) => `p${String(i).padStart(2, '0')}`)];
  const photos = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await img(`${base}photos/${n}.jpg`)])));
  const logo = Object.fromEntries(await Promise.all(['aperture', 'paw', 'text', 'full'].map(async (n) => [n, await img(`${base}logo/logo_${n}.png`)])));
  return { photos, logo };
}
