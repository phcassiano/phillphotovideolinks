// Momentos dos efeitos sonoros, em segundos, derivados dos tempos do config.
import { CONFIG, sceneStart } from './config';

const s = (k: Parameters<typeof sceneStart>[0]) => sceneStart(k) / CONFIG.fps;
export type Cue = { t: number; type: 'impact' | 'stamp' | 'whoosh' | 'shutter' | 'pop' | 'tick' | 'ding' | 'riser' | 'crash'; i?: number; dur?: number; g?: number };

export const CUES: Cue[] = [
  { t: 0, type: 'shutter' }, { t: 0.02, type: 'impact' },
  { t: 0.35, type: 'stamp' }, { t: 0.65, type: 'stamp' }, { t: 0.95, type: 'stamp' },
  { t: 1.6, type: 'riser', dur: s('capas') - 1.6 },
  ...CONFIG.capas.flatMap((_, k) => {
    const t = s('capas') + k * (CONFIG.sceneSeconds.capas / CONFIG.capas.length);
    return [{ t, type: 'whoosh' as const }, { t: t + 0.12, type: 'shutter' as const }, { t: t + 0.35, type: 'pop' as const, i: k }];
  }),
  ...CONFIG.passos.items.map((_, i) => ({ t: s('passos') + 0.35 + i * 0.5, type: 'pop' as const, i: i + 2 })),
  { t: s('data') - 0.9, type: 'riser', dur: 0.9 }, { t: s('data') + 0.25, type: 'stamp' }, { t: s('data') + 0.25, type: 'crash', g: 0.6 },
  { t: s('cta'), type: 'whoosh' }, { t: s('cta') + 0.6, type: 'stamp' }, { t: s('cta') + 1.3, type: 'pop', i: 4 }, { t: s('cta') + 1.7, type: 'ding' },
];
