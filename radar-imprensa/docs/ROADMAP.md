# Funcionalidades futuras

## Curto prazo
- Verificação de reivindicação por token enviado ao e-mail corporativo do veículo.
- Convites e gestão de membros por organização; papéis dentro da organização (editor/leitor de mailings).
- Tela para vincular solicitações LGPD a perfis e responder titulares por e-mail.
- Importação assíncrona (fila) para arquivos grandes, com relatório para download.
- Carga completa de municípios do IBGE via API oficial de localidades.
- `supabase gen types` no CI para tipagem automática das consultas.

## Verificação e qualidade dos dados
- Adaptadores para fontes institucionais autorizadas (expedientes publicados em formato aberto, APIs de veículos parceiros).
- Detecção de mudança de editoria e de cidade a partir das evidências.
- Painel de qualidade por veículo e por estado (cobertura, idade média da confirmação).
- Notificação ao titular quando houver proposta de alteração no seu perfil.

## Inteligência artificial (fase 2)
- Adaptador de LLM para `PautaInterpreter` retornando apenas a interpretação estruturada (editorias, UFs, entidades), com o
  ranking mantido sobre candidatos do banco.
- Evidências de cobertura (temas das matérias assinadas) para enriquecer o ranking, com motivos auditáveis.
- Avaliação offline do ranking com pautas de referência.

## Produto
- Envio de releases com rastreio de abertura (com consentimento e opção de descadastro).
- Planos e cobrança; limites de uso por plano.
- Aplicativo móvel (PWA).
