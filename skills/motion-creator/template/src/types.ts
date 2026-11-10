// Formato do arquivo video.json — é ele que a skill escreve a cada vídeo.

export type ThemeName =
  | "neon-city"
  | "analogico"
  | "quadro"
  | "pop"
  | "luxo"
  | "mapa";

export type MascotShape = "cubo" | "gota" | "fantasma";

export interface MascotConfig {
  enabled: boolean;
  shape?: MascotShape;
  color?: string;
  /** posição padrão: canto inferior esquerdo / direito */
  side?: "left" | "right";
  accessory?: "nenhum" | "bone" | "oculos" | "coroa" | "fone";
}

export interface ProgressConfig {
  enabled: boolean;
  total: number;
}

export interface CaptionWord {
  text: string;
  start: number; // segundos
  end: number; // segundos
}

export interface SceneBase {
  /** tipo da cena (ver references/cenas.md) */
  type: string;
  /** duração em segundos */
  duration: number;
  /** frase de legenda da cena. Use *asteriscos* para destacar palavras */
  caption?: string;
  /** posição da legenda */
  captionPosition?: "top" | "middle" | "bottom";
  /** passo atual na barra de progresso (estrelas). 0 = esconder */
  step?: number;
  /** mostrar mascote nesta cena (sobrepõe o global) */
  mascot?: boolean;
  /** tema só desta cena (sobrepõe o global) */
  theme?: ThemeName;
  /** demais propriedades específicas do tipo de cena */
  props?: Record<string, any>;
}

export interface VideoSpec {
  title?: string;
  fps?: number;
  width?: number;
  height?: number;
  theme: ThemeName;
  mascot?: MascotConfig;
  progress?: ProgressConfig;
  /** arquivo em public/ — trilha de fundo */
  music?: string;
  musicVolume?: number;
  /** arquivo em public/ — narração / áudio de voz */
  voiceover?: string;
  /** legendas palavra-a-palavra (modo áudio / câmera). Se existir, substitui as captions das cenas */
  words?: CaptionWord[];
  /** liga efeitos sonoros sintetizados (whoosh/pop) gerados por scripts/sfx.sh */
  sfx?: boolean;
  scenes: SceneBase[];
}
