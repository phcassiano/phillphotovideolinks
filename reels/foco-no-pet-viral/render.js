// Renderiza o reel quadro a quadro no Chromium (Playwright) e junta com a trilha no ffmpeg.
// Uso: npm install && npm run render  →  foco-no-pet-reels.mp4 (1080x1920, 30 fps, H.264 + AAC)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUT = process.argv[2] || join(ROOT, 'foco-no-pet-reels.mp4');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.wav': 'audio/wav' };

const server = createServer(async (req, res) => {
  const path = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!path.startsWith(ROOT)) return res.writeHead(403).end();
  try { res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }).end(await readFile(path.endsWith('/') ? path + 'index.html' : path)); }
  catch { res.writeHead(404).end(); }
}).listen(0, '127.0.0.1');
await new Promise((ok) => server.once('listening', ok));
const url = `http://127.0.0.1:${server.address().port}/index.html?render`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__reelReady === true, null, { timeout: 60000 });
const { DURATION, FPS } = await page.evaluate(() => ({ DURATION: window.__reel.DURATION, FPS: window.__reel.FPS }));
const frames = Math.round(DURATION * FPS);

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-i', join(ROOT, 'efeitos-foco-no-pet.wav'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });

for (let i = 0; i < frames; i++) {
  const data = await page.evaluate((t) => window.__reel.frame(t), i / FPS);
  const jpg = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
  if (!ff.stdin.write(jpg)) await new Promise((ok) => ff.stdin.once('drain', ok));
  if (i % 60 === 0) process.stdout.write(`\r${i}/${frames}`);
}
ff.stdin.end();
await new Promise((ok, err) => ff.on('close', (c) => (c ? err(new Error(`ffmpeg saiu com ${c}`)) : ok())));
await browser.close(); server.close();
console.log(`\r${frames}/${frames}  →  ${OUT}`);
