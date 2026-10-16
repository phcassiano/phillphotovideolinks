// Efeitos sonoros do Reels "Se o seu pet pudesse falar", a partir de ./config.ts
import { CONFIG } from '../config';
import type { Cue } from '../cues';
import { FALA, FALA_SCENES, fStart } from './config';

const s = (k: Parameters<typeof fStart>[0]) => fStart(k) / CONFIG.fps;
const talk = Object.entries(FALA.cenas).flatMap(([k, c]) =>
  c.falas.flatMap((f, i) => {
    const t = s(k as never) + f.at;
    const emo = 'mood' in c && c.mood === 'emo';
    return emo ? [{ t, type: 'pop' as const, i: 0 }] : [{ t, type: 'pop' as const, i: i + 3 }, { t: t + 0.08, type: 'tick' as const }, { t: t + 0.16, type: 'tick' as const }, { t: t + 0.24, type: 'tick' as const }];
  }),
);

export const CUES: Cue[] = [
  ...FALA_SCENES.slice(1).map((k) => ({ t: s(k), type: 'whoosh' as const })),
  ...talk,
  { t: s('fotos') + FALA.cenas.fotos.tremida, type: 'stamp' },
  { t: s('emocao') - 0.1, type: 'crash', g: 0.4 },
  { t: s('pedido'), type: 'impact' }, { t: s('pedido') + 0.5, type: 'pop', i: 1 }, { t: s('pedido') + 0.75, type: 'pop', i: 2 }, { t: s('pedido') + 1.0, type: 'pop', i: 3 },
  { t: s('cta'), type: 'stamp' }, { t: s('cta') + 0.5, type: 'pop', i: 5 }, { t: s('cta') + 0.9, type: 'stamp' }, { t: s('cta') + 1.6, type: 'ding' },
];

export const SHAKES: [number, number][] = [[s('fotos') + FALA.cenas.fotos.tremida, 14], [s('pedido'), 18], [s('cta'), 12], [s('cta') + 0.9, 12]];
