import { serverEnv } from '~/lib/env.server';

export function loader() {
  const body = `User-agent: *
Allow: /
Disallow: /painel
Disallow: /admin
Disallow: /api/
Disallow: /auth/
Disallow: /sair
Disallow: /cadastro/confirme
Disallow: /redefinir-senha

Sitemap: ${serverEnv.siteUrl}/sitemap.xml
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
}
