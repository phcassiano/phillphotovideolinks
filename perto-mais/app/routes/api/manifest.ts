import { site } from '~/config/site';

// Manifest gerado da configuração, para o nome do produto vir de um só lugar.
export function loader() {
  const manifest = {
    name: site.name,
    short_name: site.shortName,
    description: site.description,
    lang: site.language,
    start_url: '/?origem=pwa',
    scope: '/',
    display: 'standalone',
    background_color: site.backgroundColor,
    theme_color: site.themeColor,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Mapa', url: '/mapa' },
      { name: 'Categorias', url: '/categorias' },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' },
  });
}
