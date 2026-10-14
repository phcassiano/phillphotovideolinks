// Valida o links.json antes de subir: npm run check
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseConfig } from '../lib/config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let config;
try {
  config = parseConfig(readFileSync(join(root, 'links.json'), 'utf8'));
} catch (err) {
  console.error(`links.json inválido: ${err.message}`);
  process.exit(1);
}
for (const l of config.links) console.log(`/go/${l.slug.padEnd(42)} → ${l.url}`);
for (const w of config.warnings) console.warn(`aviso: ${w}`);
console.log(`\n${config.links.length} links OK`);
process.exit(config.warnings.length ? 1 : 0);
