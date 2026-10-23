import {staticFile} from 'remotion';

export const LARGURA = 1080;
export const ALTURA = 1920;
export const FPS = 30;

// Aceita URL completa ou caminho relativo à pasta public/.
export const resolverSrc = (src: string) =>
  /^(https?:|data:|blob:)/.test(src) ? src : staticFile(src);
