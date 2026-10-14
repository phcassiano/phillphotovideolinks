// Somente efeitos sonoros (sem trilha), sincronizados com a linha do tempo do modelo:
// clique de câmera em cada foto, impactos, whooshes, pops, roleta e subidas de tensão.
// Uso: node efeitos.js [reel|fds]  →  efeitos-<NAME>.wav (44.1 kHz, estéreo, 16 bits). Sem samples externos.
import { writeFileSync } from 'node:fs';
const { DURATION, CUES, NAME } = await import(`./${process.argv[2] || 'reel'}.js`);

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

for (const c of CUES) {
  ({ impact, stamp, whoosh: (t) => whoosh(t), shutter, pop: (t) => pop(t, c.i), tick, ding,
     riser: (t) => riser(t, c.dur), crash: (t) => crash(t, c.g) })[c.type]?.(c.t);
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
writeFileSync(new URL(`./efeitos-${NAME}.wav`, import.meta.url), buf);
console.log(`efeitos-${NAME}.wav: ${DURATION}s`);
