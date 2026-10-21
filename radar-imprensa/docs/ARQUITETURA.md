# Arquitetura

## Visão geral

```
Navegador ──► Next.js (App Router, Vercel)
               ├─ proxy.ts ............ renova a sessão e exige login nas áreas protegidas
               ├─ Server Components ... leitura via RPCs/tabelas com a sessão do usuário (RLS)
               ├─ Server Actions ...... escrita validada com Zod + checagem de papel
               └─ /api/cron/verificacoes  (service_role, protegido por CRON_SECRET)
                          │
                          ▼
             Supabase PostgreSQL ── RLS em todas as tabelas
               ├─ RPCs SECURITY DEFINER (busca, perfil, contatos, exportação, revisões, importação…)
               ├─ triggers de histórico, auditoria e proteção de colunas
               └─ pg_cron: agendamento diário, marcação de desatualizados, limpeza
             Edge Function verification-dispatch ─► /api/cron/verificacoes
```

A autorização é aplicada em **três camadas**: proxy (sessão), servidor (papel, em `src/lib/auth`) e banco (RLS e RPCs). A camada
definitiva é o banco; as demais existem para UX e para falhar cedo.

## Estrutura de pastas

```
src/
  app/(public)        landing, login, cadastro, privacidade, termos
  app/(app)           área autenticada (dashboard, jornalistas, mailings, admin…)
  app/actions         Server Actions (validação Zod → RPC/tabela → revalidação)
  app/api/cron        endpoint do processamento agendado
  components/ui       design system (padrão shadcn/ui)
  lib/
    auth              sessão e matriz de permissões
    data              acesso a dados (server-only)
    search            filtros da busca ↔ URL ↔ argumentos da RPC
    csv               importação (parse, mapeamento, validação, deduplicação) e exportação segura
    identity          similaridade de nomes e avaliação de duplicidades
    confidence        política conservadora de confiança
    verification      SearchProvider, SourceExtractor, EntityResolver, ChangeDetector, VerificationService
    pauta             interpretação de pautas e ranking explicável (fase 2)
supabase/
  migrations          schema, RLS, RPCs, dados de referência, agendamentos
  seed.sql            dados fictícios de desenvolvimento
  functions           Edge Function de disparo
tests/unit | tests/db | tests/e2e
```

## Banco de dados

Entidades do enunciado, mais: `organizations`, `topics` e `journalist_topics` (temas), `journalist_identifiers` (identificadores
profissionais), `journalist_merge_suggestions` e `journalist_merges` (identidade), `favorites`, `rate_limit_events`,
`contact_access_logs`, `app_settings`, `import_batches` e `import_rows`.

Decisões principais:

- **Vínculos nunca são sobrescritos.** Mudança de emprego = encerrar (`is_current=false`, `end_date`) + criar novo. Múltiplos
  vínculos simultâneos são permitidos; vínculo atual duplicado (mesmo veículo e cargo) é bloqueado por índice único parcial.
- **Histórico automático:** triggers gravam em `journalist_change_history` cada campo alterado de jornalistas, vínculos e contatos,
  com a origem (`manual`, `importacao`, `verificacao`, `titular`, `sugestao`, `unificacao`, `sistema`) e quem aprovou.
- **Três datas separadas:** `last_checked_at` (última busca), `last_evidence_at` (última evidência), `last_verified_at` (última
  confirmação). Execução automática nunca altera `last_verified_at`.
- **Localidades:** linhas por município (com código IBGE) e uma linha por UF (`city_name` nulo), para quem atua no estado inteiro.
- **Editorias hierárquicas:** filtrar por uma editoria inclui as subeditorias (CTE recursiva).
- **Integridade:** chaves estrangeiras, checks (formato de e-mail/telefone, WhatsApp exige consentimento, datas coerentes),
  índices trigram para nomes e índices únicos contra duplicação (veículos, localidades, contatos, evidências).

## Segurança e anti-coleta

- O papel `anon` não acessa nenhuma tabela.
- Assessores **não** leem diretamente `journalists`, vínculos, contatos ou evidências. Tudo passa por RPCs com limite de uso:
  - `search_journalists`: até 50 por página, máximo de 1.000 posições navegáveis, limite por minuto;
  - `get_journalist_profile`: limite por minuto, sem contatos;
  - `get_journalist_contacts`: somente visibilidade `assinantes`, limite diário de perfis distintos e registro de acesso;
  - `journalist_cards`: só retorna perfis ligados ao usuário (favoritos, mailings acessíveis, interações);
  - `export_mailing_contacts`: só listas acessíveis, limite por hora e por tamanho, auditada.
- Triggers impedem que um usuário altere o próprio papel ou organização, e que o titular altere status de verificação.
- O `max_rows` do PostgREST é limitado em `supabase/config.toml`.
- CSV exportado neutraliza fórmulas (injeção em planilhas). Cabeçalhos de segurança são definidos em `next.config.ts`.
- Segredos ficam apenas em variáveis de servidor; a tela de configurações mostra só se estão definidos.

## Verificação periódica

1. **Agendamento** (`schedule_due_verifications`, diário via pg_cron): cria jobs para perfis com `next_check_at` vencido,
   distribui os horários ao longo de ~20 h e espalha a próxima revisão em 30 dias + variação (até 72 h).
2. **Processamento** (`/api/cron/verificacoes`, disparado pela Edge Function): reserva lotes pequenos com `FOR UPDATE SKIP LOCKED`.
   Para cada job, o `VerificationService`:
   - consulta o `SearchProvider` (somente APIs oficiais, sem baixar páginas);
   - extrai menções a veículos **já cadastrados** e e-mails literalmente presentes (`SourceExtractor`);
   - decide se a fonte é a mesma pessoa (`EntityResolver` conservador: nome sozinho tem confiança limitada);
   - compara com os dados atuais e gera propostas (`ChangeDetector`).
3. **Registro atômico** (`record_verification_outcome`): evidências pendentes, proposta e datas. Mudanças sensíveis colocam o
   perfil "em revisão" (o status anterior é restaurado se a proposta for rejeitada).
4. **Falhas:** nova tentativa com espera exponencial até `verification.max_attempts`; depois, "falhou" e reprocessamento manual.
5. **Sem provedor configurado:** o job vira "ignorada", sem simular resultados nem alterar datas.

A política de confiança (`src/lib/confidence/policy.ts`) define que emprego e contato **sempre** exigem revisão humana,
confirmação nunca é automática e evidências demonstrativas não contam. A pontuação numérica é exibida como apoio à decisão.

## Resolução de identidade

`duplicate_candidate_pairs` (SQL) levanta pares por similaridade trigram de nome ou identificador idêntico, com sinais objetivos:
veículos em comum, assinaturas com a mesma URL e registros profissionais iguais ou **conflitantes**. `assessDuplicatePair` (TS)
pontua e explica. Nenhuma unificação é automática. `merge_journalists` move os dados e guarda em `journalist_merges.moved`
exatamente o que foi movido ou copiado; `unmerge_journalists` desfaz a operação.

## Matching de pautas (fase 2)

`PautaInterpreter` (interface) → `RuleBasedPautaInterpreter` (dicionário transparente de termos → editorias, UFs, abrangência) →
candidatos obtidos **somente** de `search_journalists` → `rankCandidates` com motivos legíveis. Um adaptador de LLM futuro deve
devolver apenas a interpretação estruturada, nunca nomes ou contatos. Ativação: `FEATURE_PAUTA_MATCHING=true`.
