// Exporta o carrossel: todos os slides em PNG 1080x1350 e os slides com vídeo também em MP4 1080x1350 (4 s, 30 fps).
// Layout fica em 420x525 e o deviceScaleFactor (1080/420) leva a 1080x1350, como a skill recomenda.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUT = join(ROOT, 'out');
mkdirSync(OUT, { recursive: true });
const W = 420, H = 525, SCALE = 1080 / 420, FPS = 30, SECONDS = 3.7;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
await page.goto('file://' + join(ROOT, 'carrossel.html'), { waitUntil: 'networkidle' });
await page.waitForTimeout(3000); // fontes do Google
await page.evaluate(() => {
  document.querySelectorAll('.ig-header,.ig-dots,.ig-actions,.ig-caption').forEach((e) => (e.style.display = 'none'));
  document.querySelector('.ig-frame').style.cssText = 'width:420px;height:525px;max-width:none;border-radius:0;box-shadow:none;overflow:hidden;margin:0;';
  document.querySelector('.carousel-viewport').style.cssText = 'width:420px;height:525px;overflow:hidden;cursor:default;';
  document.body.style.cssText = 'padding:0;margin:0;display:block;overflow:hidden;';
  document.querySelectorAll('video').forEach((v) => { v.pause(); v.loop = false; });
});
const slides = await page.evaluate(() => [...document.querySelectorAll('.slide')].map((s) => s.dataset.video === '1'));
const clip = { x: 0, y: 0, width: W, height: H };

// posiciona o slide e coloca animações e vídeo no instante t (segundos)
const seek = (i, t) => page.evaluate(async ({ i, t }) => {
  const track = document.querySelector('.carousel-track');
  track.style.transition = 'none'; track.style.transform = `translateX(${-i * 420}px)`;
  const slide = document.querySelectorAll('.slide')[i];
  slide.getAnimations({ subtree: true }).forEach((a) => { a.pause(); a.currentTime = t * 1000; });
  const v = slide.querySelector('video');
  if (v) { v.pause(); await new Promise((ok) => { v.addEventListener('seeked', ok, { once: true }); v.currentTime = Math.min(t, v.duration - 0.05); }); }
}, { i, t });

for (let i = 0; i < slides.length; i++) {
  // PNG: estado final (animações concluídas)
  await seek(i, slides[i] ? 1.6 : 3);
  await page.screenshot({ path: join(OUT, `slide_${i + 1}.png`), clip });
  console.log(`slide_${i + 1}.png`);
  if (!slides[i]) continue;
  // MP4: quadro a quadro
  const file = join(OUT, `slide_${i + 1}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-vf', 'scale=1080:1350:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(SECONDS * FPS);
  for (let k = 0; k < n; k++) {
    await seek(i, k / FPS);
    const buf = await page.screenshot({ clip, type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise((ok) => ff.stdin.once('drain', ok));
  }
  ff.stdin.end();
  await new Promise((ok, err) => ff.on('close', (c) => (c ? err(new Error('ffmpeg ' + c)) : ok())));
  console.log(`slide_${i + 1}.mp4`);
}
await browser.close();
