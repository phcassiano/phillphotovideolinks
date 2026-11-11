// HTML da página pública e do /stats. Sem JavaScript no navegador.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const BASE_CSS = `
:root{
  --bg:#f7f6f3;--surface:#ffffff;--surface-hover:#fffaf7;--text:#1c1917;--muted:#6b6560;
  --border:#e7e3de;--shadow:0 1px 2px rgb(28 25 23/.06),0 1px 1px rgb(28 25 23/.04);
  color-scheme:light dark;
}
@media (prefers-color-scheme:dark){
  :root{--bg:#121110;--surface:#1c1a19;--surface-hover:#242120;--text:#f5f5f4;--muted:#a8a29e;
    --border:#2e2b29;--shadow:none}
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);
  font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  -webkit-font-smoothing:antialiased}
`;

export function renderPage({ profile, links }, { siteUrl, ogImageUrl }) {
  const title = profile.tagline ? `${profile.name} · ${profile.tagline}` : profile.name;
  const description = profile.bio || `Links de ${profile.name}`;
  const ogLocale = profile.lang.replace('-', '_');

  const items = links.map((l) => `
      <li><a class="link" href="/go/${esc(l.slug)}" rel="nofollow">
        ${l.emoji ? `<span class="emoji" aria-hidden="true">${esc(l.emoji)}</span>` : '<span class="emoji" aria-hidden="true"></span>'}
        <span class="title">${esc(l.title)}</span>
        <svg class="arrow" aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a></li>`).join('');

  return `<!doctype html>
<html lang="${esc(profile.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(siteUrl)}/">
<link rel="icon" href="${esc(profile.avatar || '/favicon.ico')}">
<link rel="apple-touch-icon" href="${esc(profile.avatar)}">
<meta name="theme-color" content="#f7f6f3" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121110" media="(prefers-color-scheme: dark)">

<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(profile.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(siteUrl)}/">
<meta property="og:locale" content="${esc(ogLocale)}">
<meta property="og:image" content="${esc(ogImageUrl)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImageUrl)}">

<style>${BASE_CSS}
:root{--accent:${profile.accent}}
main{width:100%;max-width:580px;margin:0 auto;
  padding:max(48px,env(safe-area-inset-top)) 16px max(40px,env(safe-area-inset-bottom))}
header{text-align:center;margin-bottom:28px}
.avatar{width:96px;height:96px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 16px;
  box-shadow:0 0 0 3px var(--bg),0 0 0 5px var(--accent)}
h1{font-size:1.375rem;line-height:1.25;margin:0;letter-spacing:-.01em;font-weight:700}
.tagline{margin:2px 0 0;color:var(--accent);font-weight:600;font-size:.95rem}
.bio{margin:10px auto 0;max-width:36ch;color:var(--muted);font-size:.95rem}
ul{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.link{display:grid;grid-template-columns:28px 1fr 16px;align-items:center;gap:12px;
  min-height:56px;padding:12px 16px;border-radius:14px;
  background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow);
  color:inherit;text-decoration:none;font-weight:550;line-height:1.3;
  transition:transform .15s ease,border-color .15s ease,background-color .15s ease}
.emoji{font-size:1.25rem;text-align:center;line-height:1}
.title{text-wrap:balance}
.arrow{color:var(--muted);opacity:.6;transition:transform .15s ease,opacity .15s ease,color .15s ease}
@media (hover:hover){
  .link:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--accent) 55%,var(--border));
    background:var(--surface-hover)}
  .link:hover .arrow{transform:translateX(2px);opacity:1;color:var(--accent)}
}
.link:active{transform:scale(.99)}
.link:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
footer{margin-top:36px;text-align:center;color:var(--muted);font-size:.8rem}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>
<main>
  <header>
    ${profile.avatar ? `<img class="avatar" src="${esc(profile.avatar)}" alt="" width="96" height="96">` : ''}
    <h1>${esc(profile.name)}</h1>
    ${profile.tagline ? `<p class="tagline">${esc(profile.tagline)}</p>` : ''}
    ${profile.bio ? `<p class="bio">${esc(profile.bio)}</p>` : ''}
  </header>
  <nav aria-label="Links">
    <ul>${items}
    </ul>
  </nav>
  <footer>© ${new Date().getFullYear()} ${esc(profile.name)}</footer>
</main>
</body>
</html>`;
}

const fmtInt = (n) => n.toLocaleString('pt-BR');

export function renderStats({ profile, links }, { rows, daily }, timeZone) {
  const fmtDate = new Intl.DateTimeFormat('pt-BR', { timeZone, dateStyle: 'short', timeStyle: 'short' });
  const empty = { today: 0, d7: 0, d30: 0, total: 0, last: null };

  const current = links.map((l) => ({ ...l, ...(rows.get(l.slug) ?? empty) }));
  // Slugs que estão no log mas saíram do links.json continuam visíveis.
  const known = new Set(links.map((l) => l.slug));
  const removed = [...rows].filter(([slug]) => !known.has(slug))
    .map(([slug, r]) => ({ slug, title: slug, emoji: '', removed: true, ...r }));

  const all = [...current, ...removed].sort((a, b) => b.d30 - a.d30 || b.total - a.total);
  const max30 = Math.max(1, ...all.map((r) => r.d30));
  const sum = (k) => all.reduce((acc, r) => acc + r[k], 0);

  const maxDay = Math.max(1, ...daily.map(([, n]) => n));
  const bw = 100 / daily.length;
  const bars = daily.map(([d, n], i) => {
    const h = (n / maxDay) * 100;
    return `<rect x="${(i * bw + bw * 0.15).toFixed(2)}" y="${(100 - h).toFixed(2)}" width="${(bw * 0.7).toFixed(2)}" height="${Math.max(h, 0.8).toFixed(2)}" rx="0.6"><title>${d}: ${n}</title></rect>`;
  }).join('');

  const tr = all.map((r) => `
    <tr${r.removed ? ' class="removed"' : ''}>
      <th scope="row"><span class="t">${r.emoji ? `${esc(r.emoji)} ` : ''}${esc(r.title)}</span>
        <span class="slug">/go/${esc(r.slug)}${r.removed ? ' · removido do links.json' : ''}</span>
        ${r.d30 ? `<span class="bar" style="--w:${((r.d30 / max30) * 100).toFixed(1)}%"></span>` : ''}</th>
      <td>${fmtInt(r.today)}</td><td>${fmtInt(r.d7)}</td><td>${fmtInt(r.d30)}</td><td>${fmtInt(r.total)}</td>
      <td class="last">${r.last ? fmtDate.format(r.last) : '—'}</td>
    </tr>`).join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Cliques · ${esc(profile.name)}</title>
<style>${BASE_CSS}
:root{--accent:${profile.accent}}
main{max-width:960px;margin:0 auto;padding:32px 16px 48px}
h1{font-size:1.25rem;margin:0 0 4px}
.sub{color:var(--muted);margin:0 0 24px;font-size:.9rem}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:20px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 14px}
.card b{display:block;font-size:1.5rem;font-variant-numeric:tabular-nums}
.card span{color:var(--muted);font-size:.8rem}
.chart{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:20px}
.chart p{margin:0 0 8px;color:var(--muted);font-size:.8rem}
.chart svg{display:block;width:100%;height:90px;fill:var(--accent)}
.wrap{overflow-x:auto;background:var(--surface);border:1px solid var(--border);border-radius:12px}
table{width:100%;border-collapse:collapse;font-size:.9rem}
th,td{padding:10px 12px;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap}
thead th{font-size:.75rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
tbody th{text-align:left;font-weight:500;white-space:normal;min-width:200px}
tbody tr:last-child>*{border-bottom:0}
td{font-variant-numeric:tabular-nums}
.t{display:block}
.slug{display:block;color:var(--muted);font-size:.75rem;font-weight:400}
.bar{display:block;height:4px;margin-top:6px;border-radius:2px;width:var(--w);min-width:2px;background:var(--accent);opacity:.75}
.removed{opacity:.55}
.last{color:var(--muted);font-size:.8rem}
</style>
</head>
<body>
<main>
  <h1>Cliques por link</h1>
  <p class="sub">${esc(profile.name)} · fuso ${esc(timeZone)} · <a href="/" style="color:inherit">ver página</a></p>
  <div class="cards">
    <div class="card"><b>${fmtInt(sum('today'))}</b><span>hoje</span></div>
    <div class="card"><b>${fmtInt(sum('d7'))}</b><span>últimos 7 dias</span></div>
    <div class="card"><b>${fmtInt(sum('d30'))}</b><span>últimos 30 dias</span></div>
    <div class="card"><b>${fmtInt(sum('total'))}</b><span>desde o início</span></div>
  </div>
  <div class="chart">
    <p>Cliques por dia · ${esc(daily[0][0])} a ${esc(daily.at(-1)[0])}</p>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Cliques por dia nos últimos 30 dias">${bars}</svg>
  </div>
  <div class="wrap">
    <table>
      <thead><tr><th scope="col" style="text-align:left">Link</th><th scope="col">Hoje</th><th scope="col">7 d</th><th scope="col">30 d</th><th scope="col">Total</th><th scope="col">Último</th></tr></thead>
      <tbody>${tr}
      </tbody>
    </table>
  </div>
</main>
</body>
</html>`;
}
