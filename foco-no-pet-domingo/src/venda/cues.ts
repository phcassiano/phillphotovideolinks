// Efeitos sonoros e tremidas do Reels de venda, em segundos, a partir dos tempos de ./config.ts
import { CONFIG } from '../config';
import type { Cue } from '../cues';
import { montagemTimeline, VENDA, VendaKey, vFrames, vStart } from './config';

const s = (k: VendaKey) => vStart(k) / CONFIG.fps;
const per = (k: VendaKey, n: number) => vFrames(k) / n / CONFIG.fps;

export const CUES: Cue[] = [
  { t: 0, type: 'whoosh' },
  ...Array.from({ length: 10 }, (_, i) => ({ t: 0.05 + i * 0.12, type: 'tick' as const })),
  { t: 40 / CONFIG.fps, type: 'impact' }, { t: 40 / CONFIG.fps, type: 'stamp' },
  ...VENDA.dor.flatMap((_, k) => [{ t: s('dor') + k * per('dor', VENDA.dor.length), type: 'shutter' as const }, { t: s('dor') + k * per('dor', VENDA.dor.length) + 0.17, type: 'stamp' as const }]),
  { t: s('virada') - 0.6, type: 'riser', dur: 0.6 }, { t: s('virada'), type: 'impact' }, { t: s('virada'), type: 'crash', g: 0.7 },
  ...montagemTimeline().map((m) => ({ t: s('montagem') + m.start / CONFIG.fps, type: 'shutter' as const })),
  { t: s('oferta'), type: 'whoosh' }, ...[0, 1, 2, 3].map((i) => ({ t: s('oferta') + (8 + i * 8) / CONFIG.fps, type: 'pop' as const, i: i + 1 })),
  { t: s('urgencia'), type: 'stamp' }, { t: s('urgencia') + 8 / CONFIG.fps, type: 'stamp' },
  ...Array.from({ length: 8 }, (_, i) => ({ t: s('urgencia') + 0.4 + i * 0.2, type: 'tick' as const })),
  { t: s('emocao'), type: 'whoosh' },
  { t: s('cta'), type: 'impact' }, { t: s('cta') + 10 / CONFIG.fps, type: 'pop', i: 5 }, { t: s('cta') + 22 / CONFIG.fps, type: 'stamp' }, { t: s('cta') + 1.2, type: 'ding' },
];

// [segundo, intensidade] das tremidas de câmera
export const SHAKES: [number, number][] = CUES.filter((c) => c.type === 'stamp' || c.type === 'impact').map((c) => [c.t, c.type === 'impact' ? 22 : 14]);
