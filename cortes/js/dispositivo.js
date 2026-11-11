// Detecção de celular (tela de toque pequena) e do que o aparelho consegue fazer.
const toque = matchMedia("(pointer: coarse)").matches;
export const CELULAR = toque && Math.min(screen.width, screen.height) < 820;
export const TOQUE = toque;

/** o navegador consegue abrir o menu "Compartilhar" com um arquivo de vídeo? */
export const podeCompartilhar = (mime = "video/mp4") => {
  try {
    return !!navigator.canShare?.({ files: [new File([new Uint8Array(1)], "a." + (mime.includes("mp4") ? "mp4" : "webm"), { type: mime.split(";")[0] })] });
  } catch {
    return false;
  }
};
