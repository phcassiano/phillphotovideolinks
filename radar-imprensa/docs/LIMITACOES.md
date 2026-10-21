# Limitações conhecidas

Itens que dependem de configuração externa ou que ainda não foram validados. Nenhum deles foi declarado pronto.

## Dependem de configuração ou serviço externo

- **Projeto Supabase real:** o app foi testado contra PostgreSQL 16 + PostgREST reais e uma emulação de Auth. A integração com o
  Supabase Auth real (e-mail de confirmação, link `/auth/confirm`, renovação de sessão) e com o Supabase CLI (`db push`,
  `functions deploy`) **não foi executada** neste ambiente, que não tem Docker nem credenciais.
- **pg_cron, pg_net e Edge Function:** a migration de agendamento só cria os jobs quando `pg_cron` existe; nos testes locais ela é
  pulada. A Edge Function `verification-dispatch` não foi executada (requer Deno/Supabase).
- **Busca automatizada real:** o adaptador `BraveSearchProvider` segue a documentação pública da Brave Search API e foi testado
  com respostas simuladas, **sem chave real**. Por padrão (`VERIFICATION_PROVIDER=none`), nenhuma busca é feita e as
  verificações ficam "ignoradas".
- **Provedor demonstrativo:** gera evidências fictícias apenas para testar o fluxo; nunca deve ser usado em produção.

## Escopo do MVP

- A extração de evidências usa apenas título e trecho retornados pela API (sem baixar páginas). Reconhece veículos já cadastrados
  e cargos de uma lista fixa; não detecta mudança de editoria nem de cidade.
- Nenhuma alteração é aplicada automaticamente (a política permite, mas está desativada no código do serviço).
- Verificação de identidade na reivindicação: o sinal de "domínio do e-mail" é auxiliar; a aprovação é manual. Não há verificação
  por token enviado ao e-mail corporativo.
- Convites para organizações não existem: a organização é criada no cadastro ou atribuída pelo administrador principal.
- Solicitações de privacidade sem perfil vinculado exigem que o administrador identifique o registro; não há tela para vincular o
  perfil a uma solicitação já aberta.
- A interface de importação processa até 5.000 linhas / 5 MB por arquivo, de forma síncrona.
- Os tipos do banco são declarados manualmente (`src/lib/domain/types.ts`); `supabase gen types` pode substituí-los.
- Textos de privacidade e termos são bases a revisar juridicamente.
- O matching de pautas usa regras; não há adaptador de LLM implementado.
- Os códigos IBGE de capitais e alguns municípios foram incluídos de memória e devem ser conferidos com a tabela oficial;
  municípios ausentes são criados (sem código IBGE) na importação.
