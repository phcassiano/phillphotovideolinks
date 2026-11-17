# Decisões

Registro das decisões tomadas sem consulta (reversíveis). Mais recente no fim.

1. **App em `perto-mais/`** — a raiz do repositório já hospeda o site de links e outros projetos publicados pelo GitHub Pages. No Vercel, *Root Directory* = `perto-mais`.
2. **React Router 7.18 (não 8)** — o pedido é v7; a v8 saiu recentemente. A migração para v8 fica para depois do MVP.
3. **Supabase local via Docker para desenvolvimento e testes.** Não criei projeto na sua conta Supabase (os dois existentes são de outros produtos). Ver `docs/SETUP.md`.
4. **Leitura pública por view (`public_businesses`)** em vez de política na tabela: permite esconder `owner_id` e mascarar campos da Vitrine quando o plano vence, sem apagar nada.
5. **Plano vigente calculado pela data** (`business_plan()`): assinatura `active` dentro de `starts_at`–`ends_at`; fora disso, gratuito. Não depende de cron para vencer. `expire_subscriptions()` só arruma o status para relatórios.
6. **Plano gratuito inclui horários e pino no mapa**; Instagram vai para a Vitrine (junto de logo, capa, descrição, galeria e catálogo).
7. **Métricas só pelo servidor**: `/api/track` filtra robôs (`isbot`), aplica limite por IP e chama `track_event` com service role. Sessão = cookie anônimo `perto_sid` (12 h) com hash salgado. Dono logado não conta.
8. **Contraste**: `#E86B19` com texto branco dá 3,2:1 (falha AA em texto pequeno). Botões usam `brand-700 #A3480D` (6,1:1). Texto sobre o verde `#25D366` usa tinta escura `#07331A` (7:1), porque branco dá 2:1.
9. **Uma conta = um estabelecimento no painel** (o banco já aceita vários por dono; a UI de múltiplos fica para depois).
10. **Busca**: `websearch_to_tsquery` com configuração `pt_unaccent` + `strict_word_similarity ≥ 0,5` no nome (tolerância a erro de digitação sem trazer resultados aleatórios).
11. **Categorias de alimentação usam layout de cardápio** pela flag `categories.uses_menu_layout` (editável no admin), não por nome fixo.
12. **Página de demonstração recebe `noindex`** para não indexar negócios fictícios no Google.
13. **Seed com contas de teste** é só para ambiente local (senhas conhecidas). Em produção aplica-se apenas as migrations, que já trazem planos, categorias, Brasília e bairros.
14. **Leituras do painel no cliente (TanStack Query) e escritas críticas por action**: cadastro, dados do negócio, conta e assinatura passam por `action` com o mesmo schema Zod; produtos, fotos e horários vão direto ao Supabase pelo navegador (RLS + gatilhos validam no banco).
15. **Horários salvos por função atômica** `set_business_hours` (SECURITY INVOKER, então a RLS continua valendo).
16. **Imagens só na pasta da própria loja**: gatilho recusa `logo_path`, `cover_path`, `photo_path` e `path` fora de `<business_id>/`.
17. **Verde de sucesso escurecido para `#276B43`** após a auditoria axe (o tom anterior ficava 4,4:1 nos selos).
18. **Supabase-js fora do bundle das páginas públicas**: `usePublicEnv` vive em módulo próprio.
19. **Teste E2E recria o banco** (`npm run test:e2e` roda `supabase db reset`), para ser determinístico.
20. **Capas de demonstração sem texto**: o nome já aparece no card da página.
