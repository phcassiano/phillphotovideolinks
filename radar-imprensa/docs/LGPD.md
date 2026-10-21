# Privacidade e LGPD

Este documento resume como o MVP trata dados pessoais. Ele não substitui a análise jurídica antes do lançamento.

## Categorias, finalidades e bases legais

| Categoria | Finalidade | Base legal (LGPD, art. 7º) | Onde está no sistema |
| --- | --- | --- | --- |
| Dados profissionais de jornalistas (nome, nome profissional, veículo, cargo, editorias, local de atuação) | Permitir que profissionais de comunicação encontrem o jornalista adequado à pauta | Legítimo interesse (IX), com teste de balanceamento e direito de oposição; dados tornados públicos pelo titular (§4º) | `journalists`, `journalist_employments` |
| Contatos profissionais (e-mail, telefone, formulário) | Envio de pautas ao canal profissional | Legítimo interesse ou consentimento (quando informado pelo titular) — campo `legal_basis` por contato | `journalist_contacts` |
| WhatsApp profissional | Canal indicado pelo próprio jornalista | Consentimento (I) — `consent_recorded_at` obrigatório no banco | `journalist_contacts` |
| Conta de usuários | Autenticação, controle de acesso | Execução de contrato (V) | `profiles`, Supabase Auth |
| Registros de uso e auditoria | Segurança e prevenção de coleta em massa | Legítimo interesse (IX) | `audit_logs`, `contact_access_logs`, `rate_limit_events` |

## Controles implementados

- **Origem registrada:** cada contato e vínculo pode apontar para `source_evidence` (URL, título, data). A UI impede liberar
  contatos sem fonte para os usuários, e a importação os marca como restritos e não verificados por padrão.
- **Visibilidade por contato:** `assinantes` (usuários via RPC limitada), `restrito` (administração e titular) e `oculto`.
- **Nada é inventado ou inferido:** telefones sem DDD são rejeitados na importação; o verificador só registra e-mails literalmente
  presentes na fonte e nunca cria veículos a partir de texto livre; o provedor demonstrativo usa apenas domínios `.example`.
- **Direitos do titular:** reivindicação do perfil, edição dos próprios dados, escolha do canal preferencial, confirmação dos dados e
  solicitações de acesso, correção, ocultação, exclusão e oposição (`/privacidade`), com fila de atendimento em `/admin/revisoes`.
  - Oposição/ocultação atendida: perfil some das buscas, contatos passam a `oculto` e verificações são canceladas.
  - Exclusão atendida: a ficha e os dados derivados são apagados; a auditoria guarda apenas identificadores.
- **Minimização no acesso:** contatos só sob demanda, com limite diário por usuário; exportações limitadas e auditadas; paginação
  profunda bloqueada.
- **Auditoria:** alterações de papel, escrita em tabelas sensíveis, exportações, aprovações, unificações e solicitações.
- **Segredos:** apenas em variáveis de ambiente do servidor; nunca no navegador nem em `app_settings`.

## Pendências antes do lançamento

- Identificar controlador e encarregado (DPO) e publicar o canal oficial.
- Formalizar o teste de legítimo interesse (LIA) e o registro das operações de tratamento (art. 37).
- Definir prazos de retenção (ex.: interações e logs) e um job de expurgo correspondente.
- Revisar os textos de `/privacidade` e `/termos` com assessoria jurídica.
- Fluxo de resposta a titulares sem conta (hoje, por e-mail ao encarregado).
