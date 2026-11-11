// Link na bio: página + /go/:slug (contagem de cliques) + /stats + /og.png.
// Só Node (>= 20.12); a única dependência é o resvg, para gerar a imagem OG.
import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, statSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConfigLoader } from './lib/config.js';
import { createClickStore, isCountable } from './lib/clicks.js';
import { renderPage, renderStats } from './lib/render.js';
import { renderOgPng } from './lib/og.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '127.0.0.1';
const DATA_DIR = resolve(ROOT, process.env.DATA_DIR ?? 'data');
const TIME_ZONE = process.env.STATS_TZ ?? 'America/Sao_Paulo';
const STATS_USER = process.env.STATS_USER ?? '';
const STATS_PASS = process.env.STATS_PASS ?? '';
const PUBLIC_DIR = join(ROOT, 'public');

mkdirSync(DATA_DIR, { recursive: true });
const loadConfig = createConfigLoader(join(ROOT, 'links.json'));
const clicks = createClickStore(join(DATA_DIR, 'clicks.log'), TIME_ZONE);
loadConfig(); // falha cedo se o links.json estiver inválido

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

const STATIC_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

function send(req, res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(req.method === 'HEAD' ? undefined : body);
}

// Responde 304 quando o navegador já tem a mesma versão.
function sendCached(req, res, body, type, cacheControl) {
  const etag = `"${createHash('sha1').update(body).digest('base64url')}"`;
  if (req.headers['if-none-match'] === etag) return send(req, res, 304, undefined, { ETag: etag });
  send(req, res, 200, body, { 'Content-Type': type, 'Cache-Control': cacheControl, ETag: etag });
}

// URL pública: o "siteUrl" do links.json, senão o host da requisição
// (o Caddy/nginx repassam Host e X-Forwarded-Proto).
function siteUrlFor(req, profile) {
  if (profile.siteUrl) return profile.siteUrl;
  const proto = String(req.headers['x-forwarded-proto'] ?? 'http').split(',')[0].trim();
  return `${proto}://${req.headers.host ?? `localhost:${PORT}`}`;
}

// A imagem só depende do links.json e do avatar, nunca da requisição:
// assim um Host forjado não força re-renderizações.
let og = { key: null, png: null };
function ogVersion(config) {
  const avatarFile = join(PUBLIC_DIR, config.profile.avatar.replace(/^\/+/, ''));
  const avatarMtime = existsSync(avatarFile) ? statSync(avatarFile).mtimeMs : 0;
  return createHash('sha1').update(`${config.hash}:${avatarMtime}`).digest('hex').slice(0, 10);
}
function ogPng(config) {
  const key = ogVersion(config);
  if (og.key !== key) {
    const host = config.profile.siteUrl ? new URL(config.profile.siteUrl).host : '';
    og = { key, png: renderOgPng(config, ROOT, host) };
  }
  return og.png;
}

function checkAuth(header) {
  const [scheme, encoded] = String(header ?? '').split(' ');
  if (scheme !== 'Basic' || !encoded) return false;
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  // Compara hashes de tamanho fixo para não vazar nada pelo tempo de resposta.
  const h = (s) => createHash('sha256').update(s).digest();
  const userOk = timingSafeEqual(h(decoded.slice(0, i)), h(STATS_USER));
  const passOk = timingSafeEqual(h(decoded.slice(i + 1)), h(STATS_PASS));
  return userOk && passOk;
}

function serveStatic(req, res, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return false; }
  const file = resolve(PUBLIC_DIR, `.${decoded}`);
  if (!file.startsWith(PUBLIC_DIR + sep) || !STATIC_TYPES[extname(file).toLowerCase()]) return false;
  if (!existsSync(file) || !statSync(file).isFile()) return false;
  sendCached(req, res, readFileSync(file), STATIC_TYPES[extname(file).toLowerCase()], 'public, max-age=3600');
  return true;
}

async function handle(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(req, res, 405, 'Método não permitido', { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
  }
  const { pathname } = new URL(req.url, 'http://x');
  const config = loadConfig();

  if (pathname === '/') {
    const siteUrl = siteUrlFor(req, config.profile);
    const html = renderPage(config, { siteUrl, ogImageUrl: `${siteUrl}/og.png?v=${ogVersion(config)}` });
    return sendCached(req, res, html, 'text/html; charset=utf-8', 'no-cache');
  }

  const go = pathname.match(/^\/go\/([a-z0-9-]{1,80})\/?$/);
  if (go) {
    const link = config.bySlug.get(go[1]);
    if (!link) return send(req, res, 302, undefined, { Location: '/', 'Cache-Control': 'no-store' });
    if (isCountable(req)) {
      // Se o disco falhar, o visitante ainda é redirecionado.
      await clicks.record(link.slug).catch((err) => console.error(`[clicks] ${err.message}`));
    }
    return send(req, res, 302, undefined, { Location: link.url, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  }

  if (pathname === '/stats' || pathname === '/stats/') {
    if (!STATS_USER || !STATS_PASS) {
      return send(req, res, 503, 'Defina STATS_USER e STATS_PASS no .env para liberar o /stats.', { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    if (!checkAuth(req.headers.authorization)) {
      return send(req, res, 401, 'Autenticação necessária', {
        'WWW-Authenticate': 'Basic realm="stats", charset="UTF-8"',
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      });
    }
    const html = renderStats(config, await clicks.summary(30), TIME_ZONE);
    return send(req, res, 200, html, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  }

  if (pathname === '/og.png') {
    return sendCached(req, res, ogPng(config), 'image/png', 'public, max-age=86400');
  }

  if (pathname === '/robots.txt') {
    return send(req, res, 200, 'User-agent: *\nDisallow: /go/\nDisallow: /stats\n', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  if (serveStatic(req, res, pathname)) return;
  send(req, res, 404, 'Não encontrado', { 'Content-Type': 'text/plain; charset=utf-8' });
}

const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) send(req, res, 500, 'Erro interno', { 'Content-Type': 'text/plain; charset=utf-8' });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`link na bio em http://${HOST}:${PORT}  (cliques em ${join(DATA_DIR, 'clicks.log')})`);
  if (!STATS_USER || !STATS_PASS) console.warn('aviso: STATS_USER/STATS_PASS vazios, /stats desativado');
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
