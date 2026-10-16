// =============================================================
//  Foco no Pet · Reels "Se o seu pet pudesse falar" (engraçado + emocional)
//  Data, horário, local e WhatsApp vêm de ../config.ts (CONFIG).
//  Cada cena: um clipe/foto do pet + as falas dele (balão), com o segundo em que entram.
// =============================================================
import { CONFIG } from '../config';

export type Fala = { at: number; text: string };
export type Cena = { clip?: string; photo?: string; seconds: number; falas: Fala[]; tremida?: number; mood?: 'fun' | 'emo' };

export const FALA = {
  tag: '🔊 tradução do latido',
  cenas: {
    hook: { clip: 'clips/fala-p04.mp4', seconds: 3, falas: [{ at: 0.15, text: 'Humano, a gente precisa conversar. 😤' }] },
    fotos: {
      clip: 'clips/p01.mp4', seconds: 3.2, tremida: 1.5, // a partir de 1,5 s o próprio clipe "treme"
      falas: [{ at: 0.1, text: 'Você tira 300 fotos minhas por dia…' }, { at: 1.5, text: '…e TODAS saem tremidas. 😑' }],
    },
    modelo: { clip: 'clips/fala-p05.mp4', seconds: 2.8, falas: [{ at: 0.1, text: 'Eu sou um MODELO. 💅' }, { at: 1.3, text: 'Mereço um ensaio de verdade.' }] },
    pose: {
      clip: 'clips/p06.mp4', seconds: 2.8,
      falas: [{ at: 0.1, text: `Domingo tem estúdio no ${CONFIG.local}…` }, { at: 1.4, text: '…e eu já treinei a pose. 😌' }],
    },
    emocao: {
      clip: 'clips/fala-p12.mp4', seconds: 4.2, mood: 'emo',
      falas: [{ at: 0.2, text: 'Eu cresço rápido, sabia? 🥺' }, { at: 1.5, text: 'Um dia eu não vou mais caber no seu colo.' }, { at: 2.9, text: 'Mas essa foto vai durar pra sempre. 🤍' }],
    },
  } satisfies Record<string, Cena>,
  pedido: { seconds: 3.4, titulo: 'Me leva? 🥺', foto: 'photos/p13.jpg' },
  cta: { seconds: 4, marca: 'Marca o humano que me deve esse ensaio 😂', whats: 'Chama no WhatsApp', comenta: 'ou comenta', palavra: 'EU QUERO', urgencia: 'Quem chama primeiro escolhe o horário ⏳' },
};

export type FalaKey = keyof typeof FALA.cenas | 'pedido' | 'cta';
export const FALA_SCENES: FalaKey[] = ['hook', 'fotos', 'modelo', 'pose', 'emocao', 'pedido', 'cta'];
export const fSeconds = (k: FalaKey) => (k === 'pedido' ? FALA.pedido.seconds : k === 'cta' ? FALA.cta.seconds : FALA.cenas[k].seconds);
export const fFrames = (k: FalaKey) => Math.round(fSeconds(k) * CONFIG.fps);
export const fStart = (k: FalaKey) => FALA_SCENES.slice(0, FALA_SCENES.indexOf(k)).reduce((s, x) => s + fFrames(x), 0);
export const fTotal = FALA_SCENES.reduce((s, k) => s + fFrames(k), 0);
