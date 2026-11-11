// clicks.log: uma linha por clique, "<ISO timestamp>\t<slug>\n".
// Nada de IP, user-agent ou cookie: só quando e em qual link.
import { appendFile, open, stat } from 'node:fs/promises';

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|slack|embedly|headless|curl|wget|python|go-http|node-fetch|axios/i;

export function isCountable(req) {
  if (req.method !== 'GET') return false;
  const purpose = req.headers['sec-purpose'] ?? req.headers.purpose ?? '';
  if (/prefetch|prerender/i.test(purpose)) return false;
  const ua = req.headers['user-agent'] ?? '';
  return ua !== '' && !BOT_UA.test(ua);
}

export function createClickStore(logPath, timeZone) {
  const dayFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const dayKey = (date) => dayFmt.format(date); // YYYY-MM-DD no fuso escolhido

  // Agregado em memória, lido de forma incremental: só os bytes novos do log
  // são processados a cada visita ao /stats.
  const perSlug = new Map(); // slug -> { total, last, days: Map(day -> n) }
  let offset = 0;
  let leftover = '';

  function ingest(line) {
    const [ts, slug] = line.split('\t');
    const date = new Date(ts);
    if (!slug || Number.isNaN(date.getTime())) return;
    let s = perSlug.get(slug);
    if (!s) perSlug.set(slug, (s = { total: 0, last: null, days: new Map() }));
    s.total++;
    if (!s.last || date > s.last) s.last = date;
    const d = dayKey(date);
    s.days.set(d, (s.days.get(d) ?? 0) + 1);
  }

  async function refresh() {
    let size;
    try {
      ({ size } = await stat(logPath));
    } catch (err) {
      if (err.code === 'ENOENT') return;
      throw err;
    }
    if (size < offset) { // log truncado/rotacionado: recomeça do zero
      perSlug.clear();
      offset = 0;
      leftover = '';
    }
    if (size === offset) return;
    const fh = await open(logPath, 'r');
    try {
      const buf = Buffer.alloc(size - offset);
      const { bytesRead } = await fh.read(buf, 0, buf.length, offset);
      offset += bytesRead;
      const lines = (leftover + buf.subarray(0, bytesRead).toString('utf8')).split('\n');
      leftover = lines.pop(); // linha incompleta fica para a próxima leitura
      for (const line of lines) if (line) ingest(line);
    } finally {
      await fh.close();
    }
  }

  return {
    dayKey,

    // Uma linha curta com O_APPEND é atômica na prática: cliques simultâneos
    // não se misturam.
    record(slug) {
      return appendFile(logPath, `${new Date().toISOString()}\t${slug}\n`);
    },

    async summary(days = 30) {
      await refresh();
      const now = new Date();
      const window = [];
      for (let i = days - 1; i >= 0; i--) window.push(dayKey(new Date(now - i * 864e5)));
      const today = window.at(-1);
      const last7 = new Set(window.slice(-7));

      const rows = new Map();
      const daily = new Map(window.map((d) => [d, 0]));
      for (const [slug, s] of perSlug) {
        let d7 = 0, d30 = 0;
        for (const [d, n] of s.days) {
          if (daily.has(d)) { d30 += n; daily.set(d, daily.get(d) + n); }
          if (last7.has(d)) d7 += n;
        }
        rows.set(slug, { today: s.days.get(today) ?? 0, d7, d30, total: s.total, last: s.last });
      }
      return { rows, daily: [...daily] };
    },
  };
}
