// Gera um PNG do frame central de cada cena em out/stills/, com e sem as guias de safe zone.
// Uso: npm run stills
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { CONFIG, SCENES } from '../src/config';

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'out', 'stills');
mkdirSync(outDir, { recursive: true });
const browserExecutable = process.env.BROWSER_EXECUTABLE || null;
const chromeMode = process.env.CHROME_MODE === 'chrome-for-testing' ? 'chrome-for-testing' : 'headless-shell';

(async () => {
  const serveUrl = await bundle({ entryPoint: path.join(root, 'src', 'index.ts'), publicDir: path.join(root, 'public') });
  let start = 0;
  for (const [i, key] of SCENES.entries()) {
    const len = CONFIG.sceneSeconds[key] * CONFIG.fps;
    const frame = Math.round(start + len / 2);
    for (const guides of [false, true]) {
      const inputProps = { showSafeZones: guides };
      const composition = await selectComposition({ serveUrl, id: 'FocoNoPetBF', inputProps, browserExecutable, chromeMode });
      const output = path.join(outDir, `cena${i + 1}-${key}${guides ? '-guias' : ''}.png`);
      await renderStill({ composition, serveUrl, frame, output, inputProps, browserExecutable, chromeMode });
      console.log(`frame ${frame} → ${path.relative(root, output)}`);
    }
    start += len;
  }
})();
