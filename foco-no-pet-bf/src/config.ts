// =============================================================
//  Foco no Pet · Stories Black Friday
//  Edite APENAS este arquivo para trocar textos, preços, datas,
//  cores, fotos e tempos. As cenas leem tudo daqui.
// =============================================================

export const CONFIG = {
  // ---------- vídeo ----------
  width: 1080,
  height: 1920,
  fps: 30,
  // Duração de cada cena em segundos (a soma é a duração total: 18 s)
  sceneSeconds: {
    hook: 3,
    oferta: 4,
    bonus: 3,
    escassez: 3,
    presente: 2,
    cta: 3,
  },
  // Duração da transição (fade) entre cenas, em frames
  transitionFrames: 12,

  // ---------- cores ----------
  colors: {
    background: '#0B0B0D', // preto
    surface: '#1A1A1F', // grafite (cartões)
    surfaceBorder: '#2A2A31',
    text: '#FFFFFF',
    textMuted: '#C9C9D1', // texto secundário, ainda com alto contraste
    // Tom de Natal de destaque. Dourado: '#D9B45A'  ·  Vermelho: '#D4283C'
    accent: '#D9B45A',
    // Texto sobre o botão/realce na cor de destaque
    onAccent: '#0B0B0D',
  },

  // ---------- fotos (arquivos em public/photos) ----------
  photos: {
    hook: 'photos/p13.jpg', // tela cheia com zoom lento
    oferta: 'photos/p12.jpg',
    bonus: 'photos/p06.jpg', // vira a "foto impressa"
    presente: 'photos/p01.jpg', // vai no vale-presente
    cta: 'photos/p04.jpg', // fundo desfocado do CTA
  },
  // Ponto de foco de cada foto (0 a 1): onde fica o rosto do pet
  photoFocus: {
    hook: { x: 0.52, y: 0.22 },
    oferta: { x: 0.45, y: 0.3 },
    bonus: { x: 0.44, y: 0.46 },
    presente: { x: 0.67, y: 0.4 },
    cta: { x: 0.63, y: 0.55 },
  },
  logo: 'logo/logo_full.png',

  // ---------- textos ----------
  hook: {
    title: ['Black Friday', 'Foco no Pet'],
    subtitle: ['Sem desconto.', 'Com presente.'], // a 2ª linha sai na cor de destaque
  },
  oferta: {
    eyebrow: 'Pré-venda',
    title: 'Ensaio de Natal Pet',
    items: ['20 min de sessão', 'Cenário natalino', '5 fotos tratadas'],
  },
  bonus: {
    title: 'Bônus do lote Black Friday',
    items: ['+ 1 foto impressa na hora', '+ R$ 50 de crédito pro ensaio de aniversário'],
  },
  escassez: {
    before: 'Só',
    number: 15,
    after: 'vagas',
    vendas: 'Vendas de 23 a 30/11',
    sessoes: 'Sessões em 5–6 e 12–13/12',
    local: 'Sobradinho',
  },
  presente: {
    title: 'Também como vale-presente 🎁',
    validade: 'válido até fev/2027',
    cardLabel: 'Vale-presente',
  },
  cta: {
    title: 'Garanta sua vaga',
    whatsappLabel: 'WhatsApp',
    whatsapp: '(61) 99989-0604',
  },

  // ---------- safe zones do Stories (px) ----------
  safeZone: { top: 250, bottom: 340 },
  // Altura livre acima da safe zone da base, no CTA, para o sticker de link
  ctaStickerSpace: 420,
} as const;

export type SceneKey = keyof typeof CONFIG.sceneSeconds;
export const SCENES: SceneKey[] = ['hook', 'oferta', 'bonus', 'escassez', 'presente', 'cta'];
export const totalSeconds = SCENES.reduce((s, k) => s + CONFIG.sceneSeconds[k], 0);
export const totalFrames = totalSeconds * CONFIG.fps;
