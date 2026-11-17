import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';

export default [
  // Recursos (sem layout)
  route('api/track', 'routes/api/track.ts'),
  route('api/location', 'routes/api/location.ts'),
  route('api/locais', 'routes/api/locais.ts'),
  route('manifest.webmanifest', 'routes/api/manifest.ts'),
  route('sitemap.xml', 'routes/api/sitemap.ts'),
  route('robots.txt', 'routes/api/robots.ts'),
  route('auth/confirmar', 'routes/auth/confirmar.ts'),
  route('sair', 'routes/auth/sair.ts'),

  layout('routes/public/layout.tsx', [
    index('routes/public/home.tsx'),
    route('explorar', 'routes/public/explorar.tsx'),
    route('categorias', 'routes/public/categorias.tsx'),
    route('mapa', 'routes/public/mapa.tsx'),
    route('anuncie', 'routes/public/anuncie.tsx'),
    route('planos', 'routes/public/planos.tsx'),
    route('termos', 'routes/public/termos.tsx'),
    route('privacidade', 'routes/public/privacidade.tsx'),
    route('login', 'routes/public/login.tsx'),
    route('cadastro', 'routes/public/cadastro.tsx'),
    route('cadastro/confirme', 'routes/public/cadastro-confirme.tsx'),
    route('recuperar-senha', 'routes/public/recuperar-senha.tsx'),
    route('redefinir-senha', 'routes/public/redefinir-senha.tsx'),
    route('estabelecimento/:slug', 'routes/public/estabelecimento.tsx'),
    route(':cidade', 'routes/public/cidade.tsx'),
    route(':cidade/:bairro', 'routes/public/listagem.tsx', { id: 'listagem-bairro' }),
    route(':cidade/:bairro/:categoria', 'routes/public/listagem.tsx', { id: 'listagem-categoria' }),
  ]),

  route('painel', 'routes/painel/layout.tsx', [
    index('routes/painel/index.tsx'),
    route('estabelecimento', 'routes/painel/estabelecimento.tsx'),
    route('produtos', 'routes/painel/produtos.tsx'),
    route('assinatura', 'routes/painel/assinatura.tsx'),
    route('conta', 'routes/painel/conta.tsx'),
  ]),

  route('admin', 'routes/admin/layout.tsx', [
    index('routes/admin/index.tsx'),
    route('estabelecimentos', 'routes/admin/estabelecimentos.tsx'),
    route('estabelecimentos/:id', 'routes/admin/estabelecimento.tsx'),
    route('assinaturas', 'routes/admin/assinaturas.tsx'),
    route('usuarios', 'routes/admin/usuarios.tsx'),
    route('locais', 'routes/admin/locais.tsx'),
    route('categorias', 'routes/admin/categorias.tsx'),
    route('planos', 'routes/admin/planos.tsx'),
    route('log', 'routes/admin/log.tsx'),
  ]),
] satisfies RouteConfig;
