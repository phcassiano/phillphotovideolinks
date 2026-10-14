// Lê e valida o links.json. O arquivo é relido sempre que muda (mtime),
// então editar o JSON no servidor já atualiza a página, sem reiniciar nada.
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '') || 'link';
}

function isSafeUrl(url) {
  try {
    return ALLOWED_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function parseConfig(raw) {
  const data = JSON.parse(raw);
  const p = data.profile ?? {};
  const profile = {
    name: String(p.name ?? '').trim() || 'Sem nome',
    tagline: String(p.tagline ?? '').trim(),
    bio: String(p.bio ?? '').trim(),
    avatar: String(p.avatar ?? '').trim(),
    siteUrl: String(p.siteUrl ?? '').trim().replace(/\/+$/, ''),
    lang: String(p.lang ?? 'pt-BR'),
    accent: /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(p.accent ?? '') ? p.accent : '#e8613c',
  };

  const links = [];
  const warnings = [];
  const used = new Set();
  for (const [i, l] of (Array.isArray(data.links) ? data.links : []).entries()) {
    const title = String(l?.title ?? '').trim();
    const url = String(l?.url ?? '').trim();
    if (!title || !isSafeUrl(url)) {
      warnings.push(`links[${i}] ignorado: precisa de "title" e "url" http(s)/mailto/tel`);
      continue;
    }
    let slug = l.slug ? slugify(l.slug) : slugify(title);
    if (used.has(slug)) {
      let n = 2;
      while (used.has(`${slug}-${n}`)) n++;
      warnings.push(`links[${i}]: slug "${slug}" repetido, usando "${slug}-${n}"`);
      slug = `${slug}-${n}`;
    }
    used.add(slug);
    links.push({ title, url, slug, emoji: String(l.emoji ?? '').trim() });
  }

  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 12);
  return { profile, links, warnings, hash };
}

// Cache por mtime: barato o bastante para chamar em toda requisição.
export function createConfigLoader(path) {
  let cache = null;
  let cachedMtime = -1;
  return function load() {
    const { mtimeMs } = statSync(path);
    if (cache && mtimeMs === cachedMtime) return cache;
    try {
      const next = parseConfig(readFileSync(path, 'utf8'));
      for (const w of next.warnings) console.warn(`[links.json] ${w}`);
      next.bySlug = new Map(next.links.map((l) => [l.slug, l]));
      cache = next;
      cachedMtime = mtimeMs;
    } catch (err) {
      // JSON quebrado no meio de uma edição: mantém a última versão boa no ar.
      if (!cache) throw err;
      console.error(`[links.json] erro ao ler, mantendo versão anterior: ${err.message}`);
      cachedMtime = mtimeMs;
    }
    return cache;
  };
}
