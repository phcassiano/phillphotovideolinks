// Gera supabase/seed.sql e as imagens de demonstração (public/demo) a partir de data.mjs.
// Uso: npm run demo:build
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ACCOUNTS, BUSINESSES, PALETTE } from './data.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const demoDir = join(root, 'public', 'demo');

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => (a && a.length ? `array[${a.map(q).join(', ')}]::text[]` : `'{}'::text[]`);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function initials(name) {
  const stop = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return name.split(/\s+/).filter((w) => !stop.has(w.toLowerCase())).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function wrap(text, max) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, 3);
}

async function svgToWebp(svg, file, quality = 78) {
  await mkdir(dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).webp({ quality }).toFile(file);
}

function blobs(w, h, color, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: 6 }, () => {
    const r = 40 + rnd() * (Math.min(w, h) / 2.2);
    return `<circle cx="${(rnd() * w).toFixed(0)}" cy="${(rnd() * h).toFixed(0)}" r="${r.toFixed(0)}" fill="${color}" opacity="${(0.08 + rnd() * 0.14).toFixed(2)}"/>`;
  }).join('');
}

const font = `font-family="Inter, DejaVu Sans, sans-serif"`;

const logoSvg = (name, color) => `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="48" fill="${color}"/>
  <circle cx="200" cy="56" r="70" fill="#fff" opacity=".12"/>
  <text x="128" y="150" text-anchor="middle" ${font} font-size="96" font-weight="800" fill="#fff">${esc(initials(name))}</text>
</svg>`;

const coverSvg = (name, sub, color, seed) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="480" viewBox="0 0 1200 480">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#292521"/></linearGradient></defs>
  <rect width="1200" height="480" fill="url(#g)"/>
  ${blobs(1200, 480, '#ffffff', seed)}
  <!-- ${esc(name)} · ${esc(sub)} (sem texto: o nome aparece na página) -->
</svg>`;

const photoSvg = (label, color, seed) => `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="675" viewBox="0 0 900 675">
  <rect width="900" height="675" fill="#F5F0E7"/>
  ${blobs(900, 675, color, seed)}
  <rect x="60" y="500" width="${Math.min(780, 40 + label.length * 22)}" height="86" rx="20" fill="#fff" opacity=".92"/>
  <text x="90" y="556" ${font} font-size="38" font-weight="700" fill="#292521">${esc(label)}</text>
</svg>`;

const productSvg = (name, color, seed) => {
  const lines = wrap(name, 16);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <rect width="600" height="600" fill="${color}"/>
  ${blobs(600, 600, '#ffffff', seed)}
  ${lines.map((l, i) => `<text x="300" y="${300 - (lines.length - 1) * 30 + i * 62}" text-anchor="middle" ${font} font-size="52" font-weight="800" fill="#fff">${esc(l)}</text>`).join('')}
</svg>`;
};

const sql = [];
sql.push(`-- ARQUIVO GERADO por scripts/demo/build.mjs — edite data.mjs e rode \`npm run demo:build\`.
-- Somente para desenvolvimento local: cria contas de teste com senhas conhecidas
-- e dados de demonstração (is_demo = true). Não rode em produção.
-- Para remover os dados de demonstração: npm run demo:remove
`);

// Contas
for (const a of ACCOUNTS) {
  const meta = JSON.stringify({ full_name: a.fullName, phone_e164: a.phone ?? null });
  const appMeta = JSON.stringify({ provider: 'email', providers: ['email'], ...(a.demo ? { demo: true } : {}) });
  const pw = a.password ? `extensions.crypt(${q(a.password)}, extensions.gen_salt('bf'))` : `extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf'))`;
  sql.push(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', ${q(a.id)}, 'authenticated', 'authenticated', ${q(a.email)}, ${pw}, now(), ${q(appMeta)}::jsonb, ${q(meta)}::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), ${q(a.id)}, ${q(a.id)}, jsonb_build_object('sub', ${q(a.id)}, 'email', ${q(a.email)}, 'email_verified', true), 'email', now(), now(), now())
on conflict do nothing;`);
  if (a.admin) sql.push(`insert into public.user_roles (user_id, role) values (${q(a.id)}, 'admin') on conflict do nothing;`);
}

const owner = Object.fromEntries(ACCOUNTS.map((a) => [a.key, a.id]));

await rm(demoDir, { recursive: true, force: true });
let seed = 7;
for (const [i, b] of BUSINESSES.entries()) {
  const color = PALETTE[i % PALETTE.length];
  const vitrine = b.plan === 'vitrine';
  const base = `/demo/${b.slug}`;
  let logo = null;
  let cover = null;
  if (vitrine) {
    logo = `${base}/logo.webp`;
    cover = `${base}/capa.webp`;
    await svgToWebp(logoSvg(b.name, color), join(root, 'public', logo), 85);
    await svgToWebp(coverSvg(b.name, 'Imagem de demonstração', color, seed++), join(root, 'public', cover), 72);
  }
  const status = b.status ?? 'approved';
  sql.push(`
-- ${b.name}
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select ${q(owner[b.owner])}, ${q(b.slug)}, ${q(b.name)}, c.id, ci.id, n.id, ${q(b.address)}, ${b.lat}, ${b.lng}, ${q(b.phone)}, ${q(b.whatsapp)}, ${q(b.instagram)}, ${q(b.description)}, ${arr(b.keywords)}, ${q(logo)}, ${q(cover)}, ${q(status)}, ${status === 'approved' ? `now() - interval '${40 - i} days'` : 'null'}, true, now() - interval '${45 - i} days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = ${q(b.category)} and ci.slug = 'brasilia' and n.slug = ${q(b.hood)}
on conflict (slug) do nothing;`);

  if (b.hours) {
    sql.push(`insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values ${b.hours.map(([d, o, c]) => `(${d}, ${q(o)}, ${q(c)})`).join(', ')}) as h(weekday, opens_at, closes_at)
where b.slug = ${q(b.slug)};`);
  }

  if (vitrine) {
    const ownerId = owner[b.owner];
    sql.push(`insert into public.subscriptions (business_id, plan_id, status, price_cents, provider, starts_at, ends_at, requested_by, activated_at, notes)
select b.id, p.id, 'active', p.price_cents, 'manual', now() - interval '10 days', now() + interval '355 days', ${q(ownerId)}, now() - interval '10 days', 'Demonstração'
from public.businesses b, public.plans p where b.slug = ${q(b.slug)} and p.code = 'vitrine';`);
  }
  if (b.featured) {
    sql.push(`insert into public.featured_businesses (business_id, starts_at, ends_at)
select id, now() - interval '1 day', now() + interval '60 days' from public.businesses where slug = ${q(b.slug)};`);
  }
  if (b.photos) {
    for (let p = 1; p <= b.photos; p++) {
      const path = `${base}/foto-${p}.webp`;
      const label = ['Nosso espaço', 'Atendimento', 'Detalhes'][p - 1];
      await svgToWebp(photoSvg(label, color, seed++), join(root, 'public', path), 72);
      sql.push(`insert into public.business_photos (business_id, path, caption, sort_order)
select id, ${q(path)}, ${q(label + ' (demonstração)')}, ${p} from public.businesses where slug = ${q(b.slug)};`);
    }
  }
  if (b.menu) {
    let ci = 0;
    for (const [catName, items] of Object.entries(b.menu)) {
      ci++;
      sql.push(`insert into public.product_categories (business_id, name, sort_order)
select id, ${q(catName)}, ${ci} from public.businesses where slug = ${q(b.slug)};`);
      for (const [pi, [name, desc, price, featured = false, available = true]] of items.entries()) {
        const photo = `${base}/produto-${ci}-${pi + 1}.webp`;
        await svgToWebp(productSvg(name, color, seed++), join(root, 'public', photo), 72);
        sql.push(`insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, ${q(name)}, ${q(desc)}, ${price}, ${q(photo)}, ${available}, ${featured}, ${pi + 1}
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = ${q(catName)}
where b.slug = ${q(b.slug)};`);
      }
    }
  }
}

// Métricas sintéticas dos últimos 30 dias (negócios aprovados), determinísticas.
sql.push(`
insert into public.business_metrics (business_id, day, page_views, whatsapp_clicks, phone_clicks, product_views)
select b.id, d::date,
  (abs(hashtext(b.slug || d::text)) % 25) + 3,
  (abs(hashtext(b.slug || d::text || 'w')) % 8),
  (abs(hashtext(b.slug || d::text || 'p')) % 3),
  case when exists (select 1 from public.products p where p.business_id = b.id) then (abs(hashtext(b.slug || d::text || 'v')) % 12) else 0 end
from public.businesses b, generate_series((now() at time zone 'America/Sao_Paulo')::date - 29, (now() at time zone 'America/Sao_Paulo')::date - 1, interval '1 day') d
where b.is_demo and b.status = 'approved'
on conflict (business_id, day) do nothing;`);

await writeFile(join(root, 'supabase', 'seed.sql'), sql.join('\n') + '\n');
console.log(`seed.sql gerado com ${BUSINESSES.length} estabelecimentos; imagens em public/demo`);
