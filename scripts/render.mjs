// Uso: node scripts/render.mjs <post.json> [saida.mp4]
// O post.json traz os campos da notícia e "mascara" (id em mascaras/ ou objeto completo).
// Gera o MP4 e uma capa JPG ao lado.
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [arquivoPost, saidaArg] = process.argv.slice(2);
if (!arquivoPost) {
  console.error('Uso: node scripts/render.mjs <post.json> [saida.mp4]');
  process.exit(1);
}

const post = JSON.parse(readFileSync(arquivoPost, 'utf8'));
const {mascara: mascaraRef = 'padrao', ...noticia} = post;
const mascara =
  typeof mascaraRef === 'string'
    ? JSON.parse(readFileSync(path.join(raiz, 'mascaras', `${mascaraRef}.json`), 'utf8'))
    : mascaraRef;

// Arquivos locais fora de public/ são copiados para public/_entrada/ para o render enxergar.
const prepararMidia = (src) => {
  if (/^https?:/.test(src) || existsSync(path.join(raiz, 'public', src))) return src;
  const local = path.resolve(path.dirname(arquivoPost), src);
  if (!existsSync(local)) throw new Error(`Mídia não encontrada: ${src}`);
  const hash = createHash('sha1').update(readFileSync(local)).digest('hex').slice(0, 12);
  const destino = path.join('_entrada', `${hash}${path.extname(local).toLowerCase()}`);
  mkdirSync(path.join(raiz, 'public', '_entrada'), {recursive: true});
  copyFileSync(local, path.join(raiz, 'public', destino));
  return destino;
};
noticia.midia = {...noticia.midia, src: prepararMidia(noticia.midia.src)};

const saida = path.resolve(saidaArg ?? path.join(raiz, 'out', `${path.basename(arquivoPost, '.json')}.mp4`));
const capa = saida.replace(/\.mp4$/i, '') + '-capa.jpg';
const inputProps = {noticia, mascara};
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;

console.log('Empacotando template...');
const serveUrl = await bundle({entryPoint: path.join(raiz, 'src', 'index.ts')});
const composition = await selectComposition({serveUrl, id: 'ReelNoticia', inputProps, browserExecutable});

console.log(`Renderizando ${(composition.durationInFrames / composition.fps).toFixed(1)}s...`);
let ultimo = -1;
await renderMedia({
  serveUrl,
  composition,
  inputProps,
  codec: 'h264',
  crf: 18,
  pixelFormat: 'yuv420p',
  audioCodec: 'aac',
  outputLocation: saida,
  browserExecutable,
  onProgress: ({progress}) => {
    const pct = Math.floor(progress * 10) * 10;
    if (pct !== ultimo) console.log(`  ${(ultimo = pct)}%`);
  },
});

await renderStill({
  serveUrl,
  composition,
  inputProps,
  output: capa,
  frame: Math.min(composition.durationInFrames - 1, composition.fps * 2),
  imageFormat: 'jpeg',
  jpegQuality: 92,
  browserExecutable,
});

console.log(`Pronto:\n  vídeo: ${saida}\n  capa:  ${capa}`);
