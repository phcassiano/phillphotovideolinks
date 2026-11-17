import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';

export default [
  // Recursos (sem layout)
  route('api/track', 'routes/api/track.ts'),
  route('api/location', 'routes/api/location.ts'),
  route('api/locais', 'routes/api/locais.ts'),
  route('manifest.webmanifest', 'routes/api/manifest.ts'),

  layout('routes/public/layout.tsx', [
    index('routes/public/home.tsx'),
    route('explorar', 'routes/public/explorar.tsx'),
    route('categorias', 'routes/public/categorias.tsx'),
    route('mapa', 'routes/public/mapa.tsx'),
    route('anuncie', 'routes/public/anuncie.tsx'),
    route('planos', 'routes/public/planos.tsx'),
    route('termos', 'routes/public/termos.tsx'),
    route('privacidade', 'routes/public/privacidade.tsx'),
    route('estabelecimento/:slug', 'routes/public/estabelecimento.tsx'),
    route(':cidade', 'routes/public/cidade.tsx'),
    route(':cidade/:bairro', 'routes/public/listagem.tsx', { id: 'listagem-bairro' }),
    route(':cidade/:bairro/:categoria', 'routes/public/listagem.tsx', { id: 'listagem-categoria' }),
  ]),
] satisfies RouteConfig;
