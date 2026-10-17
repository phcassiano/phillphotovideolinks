// =============================================================
//  Foco no Pet · Reels "Se o seu pet ainda não tem fotos assim…"
//  No formato da referência: texto fixo sobre cortes rápidos → montagem
//  de retratos em tela cheia (um corte a cada 0,5 s) → "agenda aberta" + selo.
//  Data, horário, local e WhatsApp vêm de ../config.ts.
// =============================================================
import { CONFIG } from '../config';

// x/y = onde fica o rosto (0 a 1), para o corte em tela cheia não pegar a cabeça
export type Shot = { photo?: string; clip?: string; x?: number; y?: number };

export const ESTRELA = {
  cut: 0.5, // segundos por imagem
  // 1. Gancho: texto fixo; só cenas com o rosto na parte de cima (o texto cai no corpo)
  hook: {
    linhas: ['SE O SEU PET', 'AINDA NÃO TEM', 'FOTOS ASSIM…'],
    final: 'PRECISAMOS CONVERSAR.',
    shots: [
      { clip: 'clips/p13.mp4', x: 0.5, y: 0.2 },
      { clip: 'clips/p01.mp4', x: 0.6, y: 0.3 },
      { photo: 'photos/hero.jpg', x: 0.5, y: 0.3 },
      { clip: 'clips/fala-p05.mp4', x: 0.45, y: 0.2 },
      { photo: 'photos/p03.jpg', x: 0.48, y: 0.3 },
      { clip: 'clips/p13.mp4', x: 0.5, y: 0.2 },
      { photo: 'photos/p13.jpg', x: 0.5, y: 0.2 },
    ] as Shot[],
  },
  // 2. Montagem sem texto: fotos e clipes animados (Veo) intercalados
  montagem: [
    { clip: 'clips/fala-p04.mp4', x: 0.55, y: 0.4 },
    { photo: 'photos/p06.jpg', x: 0.44, y: 0.46 },
    { photo: 'photos/p12.jpg', x: 0.45, y: 0.4 },
    { clip: 'clips/p04.mp4', x: 0.6, y: 0.5 },
    { photo: 'photos/p00.jpg', x: 0.3, y: 0.45 },
    { photo: 'photos/p07.jpg', x: 0.5, y: 0.5 },
    { clip: 'clips/p06.mp4', x: 0.45, y: 0.45 },
    { photo: 'photos/p02.jpg', x: 0.6, y: 0.35 },
    { photo: 'photos/p10.jpg', x: 0.52, y: 0.4 },
    { clip: 'clips/fala-p12.mp4', x: 0.5, y: 0.45 },
    { photo: 'photos/p05.jpg', x: 0.36, y: 0.3 },
    { photo: 'photos/p11.jpg', x: 0.42, y: 0.45 },
    { photo: 'photos/p01.jpg', x: 0.66, y: 0.4 },
    { photo: 'photos/p08.jpg', x: 0.7, y: 0.45 },
    { photo: 'photos/p04.jpg', x: 0.62, y: 0.5 },
    { clip: 'clips/p13.mp4', x: 0.5, y: 0.3 },
    { photo: 'photos/p13.jpg', x: 0.5, y: 0.3 },
    { photo: 'photos/p06.jpg', x: 0.44, y: 0.46 },
    { clip: 'clips/fala-p05.mp4', x: 0.4, y: 0.3 },
    { photo: 'photos/p03.jpg', x: 0.48, y: 0.4 },
  ] as Shot[],
  // 3. Final: agenda aberta + selo da marca
  final: {
    seconds: 4.6,
    clip: 'clips/fala-p12.mp4',
    titulo: 'AGENDA ABERTA PRO DOMINGO!',
    sub: 'A estrela é quem você traz ✨',
    info: `${CONFIG.domingo} · ${CONFIG.horario.replace('A partir das', 'a partir das')} · ${CONFIG.local}`,
  },
};

const fps = CONFIG.fps;
export const CUT = Math.round(ESTRELA.cut * fps);
export const HOOK_FRAMES = ESTRELA.hook.shots.length * CUT;
export const MONTAGEM_FRAMES = ESTRELA.montagem.length * CUT;
export const FINAL_FRAMES = Math.round(ESTRELA.final.seconds * fps);
export const eTotal = HOOK_FRAMES + MONTAGEM_FRAMES + FINAL_FRAMES;
