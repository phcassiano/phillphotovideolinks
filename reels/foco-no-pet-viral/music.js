// Trilha original sintetizada (120 BPM), sincronizada com a linha do tempo do reel.js.
// Gera musica-foco-no-pet.wav (44.1 kHz, estéreo, 16 bits). Sem samples externos.
import { writeFileSync } from 'node:fs';
import { DURATION, BEAT, S, CUES } from './reel.js';

const SR = 44100, N = Math.ceil(DURATION * SR);
const L = new Float32Array(N), R = new Float32Array(N);
const TAU = Math.PI * 2;

let seed = 12345;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 1073741823.5 - 1);

function add(t0, dur, fn, gain = 1, pan = 0) {
  const i0 = Math.max(0, Math.floor(t0 * SR)), i1 = Math.min(N, Math.floor((t0 + dur) * SR));
  const gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
  for (let i = i0; i < i1; i++) { const v = fn((i - t0 * SR) / SR); L[i] += v * gl; R[i] += v * gr; }
}
// filtro passa-baixa de 1 polo sobre ruído, criado por evento
function noiseFn(cut = 1, hp = false) {
  let lp = 0, prev = 0;
  return () => { const n = noise(); lp += (n - lp) * cut; if (hp) { const o = lp - prev; prev = lp; return o * 2; } return lp; };
}

const kick = (t, g = 1) => add(t, 0.45, (x) => {
  const f = 45 + 110 * Math.exp(-x * 28);
  return Math.sin(TAU * (45 * x + (110 / 28) * (1 - Math.exp(-x * 28)))) * Math.exp(-x * 7) * (f > 0 ? 1 : 0);
}, 0.95 * g);
const clap = (t, g = 1) => { const n = noiseFn(0.6, true); add(t, 0.25, (x) => n() * (Math.exp(-x * 22) + 0.6 * Math.exp(-Math.abs(x - 0.012) * 300) + 0.5 * Math.exp(-Math.abs(x - 0.024) * 300)), 0.42 * g); };
const hat = (t, open = false, g = 1, pan = 0.3) => { const n = noiseFn(0.95, true); add(t, open ? 0.22 : 0.05, (x) => n() * Math.exp(-x * (open ? 18 : 80)), 0.16 * g, pan); };
const crash = (t, g = 1) => { const n = noiseFn(0.9, true); add(t, 1.8, (x) => n() * Math.exp(-x * 2.6), 0.22 * g, -0.1); };
const shutter = (t) => { const a = noiseFn(0.8, true), b = noiseFn(0.7, true);
  add(t, 0.03, (x) => a() * Math.exp(-x * 160), 0.5, 0.2); add(t + 0.045, 0.04, (x) => b() * Math.exp(-x * 120), 0.38, -0.2); };
const tick = (t) => add(t, 0.05, (x) => Math.sin(TAU * 1900 * x) * Math.exp(-x * 90), 0.22);
const pop = (t, i = 0) => add(t, 0.09, (x) => Math.sin(TAU * (500 + i * 70) * x * (1 + 2 * Math.exp(-x * 60))) * Math.exp(-x * 45), 0.2, (i % 3 - 1) * 0.4);
const ding = (t) => [1568, 2093, 2637].forEach((f, k) => add(t + k * 0.06, 1.0, (x) => Math.sin(TAU * f * x) * Math.exp(-x * 4), 0.13));
const impact = (t) => { const n = noiseFn(0.3); add(t, 1.6, (x) => Math.sin(TAU * (38 + 60 * Math.exp(-x * 10)) * x) * Math.exp(-x * 2.2) * 1.1 + n() * Math.exp(-x * 8) * 0.6, 0.9); };
const stamp = (t) => { kick(t, 0.9); const n = noiseFn(0.5); add(t, 0.2, (x) => n() * Math.exp(-x * 25), 0.4); };
const whoosh = (t, dur = 0.5) => { const n = noiseFn(0.15); add(t - dur * 0.7, dur, (x) => { const p = x / dur; return n() * Math.sin(Math.PI * p) ** 2; }, 0.55); };
const riser = (t, dur) => { let ph = 0; const n = noiseFn(0.4, true); add(t, dur, (x) => { const p = x / dur; ph += TAU * (220 + 1400 * p * p) / SR; return (Math.sin(ph) * 0.25 + n() * 0.5) * p * p; }, 0.4); };

const saw = (f, x, partials = 7) => { let v = 0; for (let k = 1; k <= partials; k++) v += Math.sin(TAU * f * k * x) / k; return v * 0.6; };
const BAR = [ // C, G, Am, F
  { bass: 65.41, chord: [261.63, 329.63, 392.0] },
  { bass: 49.0, chord: [246.94, 293.66, 392.0] },
  { bass: 55.0, chord: [220.0, 261.63, 329.63] },
  { bass: 43.65, chord: [220.0, 261.63, 349.23] },
];
const MEL = [ // colcheias por compasso (0 = pausa)
  [659.25, 0, 783.99, 0, 880.0, 783.99, 659.25, 0],
  [587.33, 0, 659.25, 587.33, 0, 0, 783.99, 0],
  [523.25, 0, 659.25, 0, 880.0, 0, 783.99, 659.25],
  [523.25, 0, 440.0, 0, 523.25, 587.33, 659.25, 0],
];
const sidechain = (t) => { const d = (((t - S.cards) % BEAT) + BEAT) % BEAT; return 0.35 + 0.65 * Math.min(1, d / 0.22); };

function groove(from, to, { lead = false, stabs = true, hats = true, clapOn = true } = {}) {
  for (let t = from; t < to - 1e-6; t += BEAT / 2) {
    const n = Math.round((t - S.cards) / (BEAT / 2)), beatIdx = Math.floor(n / 2), off = n % 2 === 1;
    const bar = BAR[((Math.floor(beatIdx / 4) % 4) + 4) % 4];
    if (!off) { kick(t); if (clapOn && ((beatIdx % 2) + 2) % 2 === 1) clap(t); }
    if (hats) hat(t + 0.0, off, off ? 1 : 0.6, off ? 0.35 : -0.25);
    add(t, BEAT / 2, (x) => saw(bar.bass, x, 5) * Math.exp(-x * 3) * sidechain(t + x), 0.3); // baixo
    if (stabs && off) bar.chord.forEach((f, k) => add(t, 0.3, (x) => (saw(f * 1.003, x, 5) + saw(f * 0.997, x, 5)) * Math.exp(-x * 11), 0.055, (k - 1) * 0.5));
    if (lead) {
      const f = MEL[((Math.floor(beatIdx / 4) % 4) + 4) % 4][((n % 8) + 8) % 8];
      if (f) add(t, 0.3, (x) => (Math.sin(TAU * f * x) + 0.35 * Math.sin(TAU * 2 * f * x) + 0.2 * Math.sin(TAU * 3 * f * x)) * Math.exp(-x * 9), 0.12, 0.15);
    }
  }
}

// --- arranjo ---
// gancho: pad + impactos + subida
add(0, S.cards, (x) => BAR[0].chord.reduce((a, f) => a + Math.sin(TAU * f / 2 * x), 0) * Math.min(1, x / 0.3) * 0.5, 0.06);
riser(1.2, S.cards - 1.2);
crash(S.cards);
groove(S.cards, S.rush, { lead: true });
// sequência rápida: caixa acelerando + subida, um respiro antes do drop
for (let t = S.rush; t < S.grid - 0.25; t += BEAT) kick(t);
for (let t = S.rush, step = BEAT / 2; t < S.grid - 0.25; t += step) { clap(t, 0.5 + (t - S.rush) * 0.35); if (t >= S.rush + 1) step = BEAT / 4; }
add(S.rush, 1.75, (x) => saw(65.41, x, 5) * 0.5, 0.3);
riser(S.rush, 1.75);
impact(S.grid); crash(S.grid);
groove(S.grid, S.grid + 2, { lead: false });
groove(S.grid + 2, S.grid + 4, { stabs: false, clapOn: false }); // roleta mais limpa
groove(S.grid + 4, S.end - 0.5, { lead: true });
riser(S.end - 1.2, 1.2);
impact(S.end); crash(S.end);
groove(S.end, DURATION, { lead: true });

for (const c of CUES) {
  ({ impact, stamp, whoosh: (t) => whoosh(t), shutter, pop: (t) => pop(t, c.i), tick, ding })[c.type]?.(c.t);
}

// master: saturação suave + normalização a -1 dBFS
let peak = 0;
for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 1.2); R[i] = Math.tanh(R[i] * 1.2); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
const k = 0.89 / (peak || 1);
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * k)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * k)) * 32767), 46 + i * 4);
}
writeFileSync(new URL('./musica-foco-no-pet.wav', import.meta.url), buf);
console.log(`musica-foco-no-pet.wav: ${DURATION}s, pico normalizado`);
