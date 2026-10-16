// =============================================================
//  Foco no Pet · Reels de VENDA (agendamentos para o domingo)
//  Data, horário, local e WhatsApp vêm de ../config.ts (CONFIG).
//  Aqui ficam a copy, as fotos/clipes e os tempos deste Reels.
// =============================================================
import { CONFIG } from '../config';

export const VENDA = {
  // Duração de cada cena em segundos (soma = duração total)
  sceneSeconds: { hook: 3.2, dor: 2.6, virada: 1.4, montagem: 5, oferta: 3.6, urgencia: 2.2, emocao: 1.8, cta: 3.6 },

  // 1. Gancho: dor que todo dono de pet tem
  hook: {
    contador: 2347, // "fotos" no rolo da câmera
    linha1: 'Você tem 2.000 fotos do seu pet no celular…',
    linha2: ['…e', 'NENHUMA', 'pra pendurar na parede.'], // a palavra do meio sai em destaque
  },

  // 2. Agitação: as fotos "de celular" (a própria foto estragada de propósito)
  dor: [
    { photo: 'photos/p02.jpg', label: 'TREMIDA 😵‍💫', filter: 'blur(9px) saturate(0.7)', rotate: 0, zoom: 1.05 },
    { photo: 'photos/p11.jpg', label: 'ESCURA 🌑', filter: 'brightness(0.25) saturate(0.4) blur(2px)', rotate: 0, zoom: 1 },
    { photo: 'photos/p03.jpg', label: 'CORTOU A ORELHA ✂️', filter: 'blur(1.5px) saturate(0.8)', rotate: 7, zoom: 1.9 },
  ],

  // 3. Virada
  virada: 'Agora olha isso 👇',

  // 4. Montagem rápida: uma foto por batida (troque `photo` por `video: 'clips/x.mp4'` para usar um clipe animado)
  montagem: [
    { photo: 'photos/p13.jpg' }, { photo: 'photos/p01.jpg' }, { photo: 'photos/p04.jpg' }, { photo: 'photos/p06.jpg' },
    { photo: 'photos/p12.jpg' }, { photo: 'photos/p09.jpg' }, { photo: 'photos/p05.jpg' }, { photo: 'photos/p10.jpg' },
    { photo: 'photos/p08.jpg' }, { photo: 'photos/p00.jpg' },
  ] as { photo?: string; video?: string }[],
  selos: ['📸 Estúdio montado no parque', '🎨 Fundo colorido', '💡 Luz profissional', '🐾 Todo porte, toda raça'],

  // 5. Oferta
  oferta: { titulo: 'Ensaio Foco no Pet', foto: 'photos/p13.jpg' },

  // 6. Urgência (verdadeira, sem inventar números)
  urgencia: ['Quem chama primeiro', 'escolhe o horário ⏳'],

  // 7. Fechamento emocional
  emocao: ['Seu pet não vai ser', 'filhote pra sempre.', 'A foto vai. 🐾'],

  // 8. Chamada
  cta: { titulo: 'Garanta o horário do seu pet', whats: 'Chama no WhatsApp', comenta: 'ou comenta', palavra: 'QUERO' },
};

export type VendaKey = keyof typeof VENDA.sceneSeconds;
export const VENDA_SCENES: VendaKey[] = ['hook', 'dor', 'virada', 'montagem', 'oferta', 'urgencia', 'emocao', 'cta'];
export const vFrames = (k: VendaKey) => Math.round(VENDA.sceneSeconds[k] * CONFIG.fps);
export const vStart = (k: VendaKey) => VENDA_SCENES.slice(0, VENDA_SCENES.indexOf(k)).reduce((s, x) => s + vFrames(x), 0);
export const vTotal = VENDA_SCENES.reduce((s, k) => s + vFrames(k), 0);
