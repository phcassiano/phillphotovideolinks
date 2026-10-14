// Imagem Open Graph (1200×630) gerada a partir do links.json + avatar.
// SVG montado aqui e rasterizado com resvg, usando a fonte Inter do repositório
// (não depende de fontes instaladas no servidor).
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const W = 1200;
const H = 630;
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const esc = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// A Inter não tem emoji: tira antes de desenhar para não aparecer "tofu".
const stripEmoji = (s) =>
  s.replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu, '').replace(/\s{2,}/g, ' ').trim();

// Quebra de linha aproximada pela largura média dos glifos da Inter.
function wrap(text, fontSize, maxWidth, maxLines) {
  const maxChars = Math.floor(maxWidth / (fontSize * 0.54));
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) { cur = next; continue; }
    if (cur) lines.push(cur);
    cur = w;
    if (lines.length === maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  const used = lines.join(' ').split(/\s+/).length;
  if (used < words.length && lines.length) lines[lines.length - 1] = lines.at(-1).replace(/[\s,.;:–-]*$/, '…');
  return lines;
}

function avatarDataUri(rootDir, avatar) {
  if (!avatar || /^https?:/i.test(avatar)) return null;
  const file = join(rootDir, 'public', avatar.replace(/^\/+/, ''));
  const mime = MIME[extname(file).toLowerCase()];
  if (!mime || !existsSync(file)) return null;
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

export function buildOgSvg({ profile, links }, rootDir, host) {
  const name = stripEmoji(profile.name);
  const tagline = stripEmoji(profile.tagline);
  const bio = stripEmoji(profile.bio);
  const accent = profile.accent;
  const avatar = avatarDataUri(rootDir, profile.avatar);

  const textX = avatar ? 470 : 96;
  const textW = W - textX - 96;
  const nameSize = name.length > 22 ? 58 : name.length > 16 ? 68 : 78;
  const nameLines = wrap(name, nameSize, textW, 2);
  const bioLines = wrap(bio, 34, textW, 3);

  let y = 0;
  const parts = [];
  for (const l of nameLines) {
    y += nameSize * 1.08;
    parts.push(`<text x="${textX}" y="${y}" font-size="${nameSize}" font-weight="700" fill="#f5f5f4" letter-spacing="-1.5">${esc(l)}</text>`);
  }
  if (tagline) {
    y += 54;
    parts.push(`<text x="${textX}" y="${y}" font-size="38" font-weight="700" fill="${accent}">${esc(tagline)}</text>`);
  }
  if (bioLines.length) y += 22;
  for (const l of bioLines) {
    y += 46;
    parts.push(`<text x="${textX}" y="${y}" font-size="34" fill="#a8a29e">${esc(l)}</text>`);
  }
  // Centraliza o bloco de texto na vertical.
  const offsetY = Math.round((H - y) / 2 - 20);

  const footer = [host, `${links.length} links`].filter(Boolean).join('  ·  ');
  const cx = 250, cy = H / 2, r = 140;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="0.15" cy="0.2" r="0.9">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.35"/>
      <stop offset="0.6" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="circle"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="#121110"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="${H - 10}" width="${W}" height="10" fill="${accent}"/>
  ${avatar ? `<circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="none" stroke="${accent}" stroke-width="6"/>
  <image href="${avatar}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#circle)"/>` : ''}
  <g font-family="Inter" transform="translate(0 ${offsetY})">
    ${parts.join('\n    ')}
  </g>
  <text x="${textX}" y="${H - 52}" font-family="Inter" font-size="26" fill="#78716c">${esc(footer)}</text>
</svg>`;
}

export function renderOgPng(config, rootDir, host) {
  const svg = buildOgSvg(config, rootDir, host);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: {
      fontFiles: [join(rootDir, 'fonts/Inter-Regular.otf'), join(rootDir, 'fonts/Inter-Bold.otf')],
      loadSystemFonts: false,
      defaultFontFamily: 'Inter',
    },
  });
  return resvg.render().asPng();
}
