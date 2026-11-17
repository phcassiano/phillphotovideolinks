import type { Route } from './+types/sitemap';
import { serverEnv } from '~/lib/env.server';
import { createSupabaseServerClient } from '~/lib/supabase/server';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Gerado do banco, só com conteúdo aprovado (e sem dados de demonstração).
export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const base = serverEnv.siteUrl;
  const { data: rows } = await supabase
    .from('public_businesses')
    .select('slug, city_slug, neighborhood_slug, category_slug, parent_category_slug, updated_at, is_demo')
    .eq('is_demo', false)
    .limit(50000);
  const urls = new Map<string, string | null>();
  for (const p of ['/', '/explorar', '/categorias', '/mapa', '/anuncie', '/planos', '/termos', '/privacidade']) urls.set(p, null);
  for (const b of rows ?? []) {
    const lastmod = b.updated_at ?? null;
    urls.set(`/estabelecimento/${b.slug}`, lastmod);
    urls.set(`/${b.city_slug}`, null);
    urls.set(`/${b.city_slug}/${b.neighborhood_slug}`, null);
    urls.set(`/${b.city_slug}/${b.neighborhood_slug}/${b.category_slug}`, null);
    if (b.parent_category_slug) urls.set(`/${b.city_slug}/${b.neighborhood_slug}/${b.parent_category_slug}`, null);
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...urls.entries()]
  .map(([path, lastmod]) => `  <url><loc>${esc(base + path)}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}</url>`)
  .join('\n')}
</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
