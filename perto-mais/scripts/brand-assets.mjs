// Gera ícones do PWA, favicon e imagem Open Graph padrão em public/.
// Uso: npm run brand:build  (rode de novo se mudar o nome em app/config/site.ts)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const siteTs = await readFile(join(root, 'app/config/site.ts'), 'utf8');
const name = /name: '([^']+)'/.exec(siteTs)?.[1] ?? 'Perto+';
const tagline = /tagline: '([^']+)'/.exec(siteTs)?.[1] ?? '';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const pin = (s = 1) => `<g transform="scale(${s})"><path d="M16 2C9.9 2 5 6.8 5 12.8 5 21 16 30 16 30s11-9 11-17.2C27 6.8 22.1 2 16 2Z" fill="#E86B19"/><path d="M16 8.5v9M11.5 13h9" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g>`;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${pin()}</svg>`;
const appIcon = (size, padding) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" fill="#F5F0E7"/>
<g transform="translate(${padding} ${padding})">${pin((size - padding * 2) / 32)}</g></svg>`;
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#F5F0E7"/>
<circle cx="1080" cy="80" r="260" fill="#F4A261" opacity=".35"/><circle cx="120" cy="600" r="200" fill="#E86B19" opacity=".12"/>
<g transform="translate(90 120)">${pin(4)}</g>
<text x="250" y="220" font-family="Inter, DejaVu Sans, sans-serif" font-size="96" font-weight="900" fill="#292521">${esc(name)}</text>
<text x="90" y="400" font-family="Inter, DejaVu Sans, sans-serif" font-size="56" font-weight="800" fill="#292521">${esc(tagline)}</text>
<text x="90" y="480" font-family="Inter, DejaVu Sans, sans-serif" font-size="34" fill="#5f574e">Lojas, restaurantes e serviços perto de você.</text>
</svg>`;

await mkdir(join(root, 'public/icons'), { recursive: true });
await writeFile(join(root, 'public/icons/favicon.svg'), favicon);
await sharp(Buffer.from(appIcon(192, 24))).png().toFile(join(root, 'public/icons/icon-192.png'));
await sharp(Buffer.from(appIcon(512, 64))).png().toFile(join(root, 'public/icons/icon-512.png'));
await sharp(Buffer.from(appIcon(512, 120))).png().toFile(join(root, 'public/icons/maskable-512.png'));
await sharp(Buffer.from(appIcon(180, 22))).png().toFile(join(root, 'public/icons/apple-touch-icon.png'));
await sharp(Buffer.from(appIcon(48, 4))).png().toFile(join(root, 'public/favicon.ico'));
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(join(root, 'public/og-default.png'));
console.log('Ícones e OG gerados para', name);
