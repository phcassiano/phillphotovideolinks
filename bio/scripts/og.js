// Gera og-preview.png para conferir a imagem de compartilhamento sem subir o servidor.
// Uso: npm run og
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseConfig } from '../lib/config.js';
import { renderOgPng } from '../lib/og.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = parseConfig(readFileSync(join(root, 'links.json'), 'utf8'));
const host = config.profile.siteUrl ? new URL(config.profile.siteUrl).host : '';
const out = join(root, 'og-preview.png');
writeFileSync(out, renderOgPng(config, root, host));
console.log(`imagem salva em ${out}`);
