// =============================================================
//  Foco no Pet · Reels "Seu pet na capa" (ensaios do próximo domingo)
//  Edite APENAS este arquivo: data, textos, capas, cores e tempos.
//  Para reaproveitar toda semana, troque só `domingo`.
// =============================================================

export const CONFIG = {
  width: 1080,
  height: 1920,
  fps: 30,

  // Data do próximo domingo (aparece no gancho, nas capas e na chamada)
  domingo: '18/10',
  horario: 'A partir das 7h',
  local: 'Parque dos Jequitibás',
  cidade: 'Sobradinho-DF',
  whatsapp: '(61) 99989-0604',
  palavraComentario: 'CAPA', // palavra que a pessoa comenta para receber as informações

  // Duração de cada cena em segundos (soma = duração total)
  sceneSeconds: { hook: 3, capas: 7.5, passos: 3.5, data: 3, cta: 4 },
  transitionFrames: 10,

  colors: {
    background: '#0C0B0A',
    paper: '#F4EFE6',
    text: '#FFFFFF',
    dark: '#141210',
    accent: '#E15A0A', // laranja da marca
    accentSoft: '#FFB37A',
  },

  // ---------- 1. gancho ----------
  hook: {
    photo: 'photos/p13.jpg',
    focus: { x: 0.52, y: 0.2 },
    lines: ['Domingo agora', 'seu pet vira capa', 'de revista 📸'], // a última linha sai em destaque
  },

  // ---------- 2. capas (uma a cada 1,5 s) ----------
  revista: { masthead: 'FOCO', sub: 'NO PET' },
  capas: [
    { photo: 'photos/p01.jpg', focus: { x: 0.67, y: 0.4 }, headline: 'ESTILO', sub: 'o lulu que nasceu pra posar' },
    { photo: 'photos/p04.jpg', focus: { x: 0.63, y: 0.55 }, headline: 'SORRISO', sub: 'o mais simpático do parque' },
    { photo: 'photos/p06.jpg', focus: { x: 0.44, y: 0.46 }, headline: 'OLHAR', sub: 'fofura sem filtro' },
    { photo: 'photos/p12.jpg', focus: { x: 0.45, y: 0.3 }, headline: 'ATITUDE', sub: 'grandão e gentil' },
    { photo: 'photos/p09.jpg', focus: { x: 0.52, y: 0.43 }, headline: 'TOCA AQUI', sub: 'pura energia de domingo' },
  ],

  // ---------- 3. como funciona ----------
  passos: {
    title: 'Como garantir:',
    items: ['Chama no WhatsApp', 'Escolhe o horário de domingo', 'Seu pet vira capa ✨'],
  },

  // ---------- 4. data ----------
  data: {
    kicker: 'Neste',
    dia: 'DOMINGO',
    aviso: 'Agenda aberta · horários por ordem de agendamento',
  },

  // ---------- 5. chamada ----------
  cta: {
    capaVazia: 'SEU PET AQUI?',
    comenta: 'Comenta', // + palavraComentario
    depois: 'que a gente te manda os horários',
    ou: 'ou chama no WhatsApp',
  },

  // Safe zone do Reels (px): topo, base (legenda/botões) e lateral direita (botões)
  safeZone: { top: 220, bottom: 420, side: 90, right: 130 },
} as const;

export type SceneKey = keyof typeof CONFIG.sceneSeconds;
export const SCENES: SceneKey[] = ['hook', 'capas', 'passos', 'data', 'cta'];
export const sceneFrames = (k: SceneKey) => Math.round(CONFIG.sceneSeconds[k] * CONFIG.fps);
export const sceneStart = (k: SceneKey) => SCENES.slice(0, SCENES.indexOf(k)).reduce((s, x) => s + sceneFrames(x), 0);
export const totalFrames = SCENES.reduce((s, k) => s + sceneFrames(k), 0);
