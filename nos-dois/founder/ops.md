# Operação do Nós Dois

> É um app, não uma loja: a "operação" é manter o app no ar, responder casais, produzir conteúdo e cuidar dos dados. Regras mudam e variam; tudo que é legal ou fiscal deve ser confirmado com contador e advogado. Isso não é aconselhamento jurídico.

## 1. O ciclo de cada dia (fundador sozinho)
| # | Passo | O cliente vê? |
|---|---|---|
| 1 | 08h: olhar alertas de erro e o painel do banco de dados (5 min) | não |
| 2 | 08h10: responder mensagens de suporte (e-mail e Instagram), meta de 24 h | **sim** |
| 3 | Gravar ou editar o conteúdo do dia (`marketing.md`) | **sim** |
| 4 | 1 h de produto: corrigir o que os casais pediram | sim (na próxima versão) |
| 5 | 18h: publicar o conteúdo e responder comentários | **sim** |
| 6 | Sexta: escrever 7 perguntas novas do dia e revisar a semana em pt-BR | **sim** |
| 7 | Domingo: anotar os números da semana (ver `launch.md`) | não |

## 2. Fornecedores e ferramentas
| Item | Opções | Preço público | Observação |
|---|---|---|---|
| Banco de dados, autenticação, tempo real | **Supabase** / Firebase | Pro US$ 25/mês + computação ([MakerKit](https://makerkit.dev/blog/md/saas/supabase-pricing)) | o protótipo já sincroniza em tempo real; migrar o armazenamento |
| App iOS e Android | **Expo (React Native)** / Flutter | Expo tem plano grátis; build pago opcional (confirmar no site) | um código para as duas lojas |
| Assinaturas nas lojas | **RevenueCat** | grátis até US$ 2,5 mil/mês de receita, depois 1% ([docs](https://www.revenuecat.com/docs/welcome/set-up-revenuecat/account-management)) | evita escrever a cobrança do zero |
| Lojas | Apple Developer / Google Play | US$ 99/ano / US$ 25 uma vez | conta no CNPJ |
| Monitorar erros | Sentry (plano grátis) | grátis no início (confirmar limites) | |
| Página da lista de espera | o próprio artifact ou Carrd/Framer | R$ 0 a ~R$ 100/mês (**estimativa**) | |
| E-mail do domínio | Zoho Mail / Google Workspace | confirmar preço atual | suporte@ |
| Contabilidade | escritório ou contador online | R$ 400/mês (**estimativa**; pedir 3 orçamentos) | ME no Simples, Fator R |
| Desenvolvimento (se terceirizar) | freelancer React Native | R$ 12 mil (**estimativa**; pedir 3 orçamentos) | ou o fundador termina com IA, o que corta R$ 12 mil do caixa (`cfo.md`) |

Os custos de `numbers.json` seguem valendo; com um orçamento real de freelancer ou contador, atualize o arquivo e rode o CFO de novo.

## 3. Pessoas
- **Fase de teste e primeiros 3 meses:** só o fundador, cerca de 20 h por semana (conteúdo 8 h, produto 8 h, suporte 2 h, admin 2 h).
- **Com mais de 300 casais pagantes:** freelancer de desenvolvimento por hora para manutenção, mais um(a) redator(a) de perguntas e conteúdo (R$ 800 a 1.500/mês, **estimativa**).
- Pró-labore de 1 salário mínimo (R$ 1.621) para o Fator R; encargos (INSS sobre pró-labore) com o contador.

## 4. Rotinas
**A. Lançar uma versão (a cada 2 semanas)**
1. Listar o que mudou, em pt-BR, sem jargão.
2. Testar os 5 caminhos críticos nos dois celulares do casal de teste: convite → parceiro entra → os dois respondem a pergunta → tarefa com "valeu" → conta acertada.
3. Enviar para as lojas; revisar prints e textos.
4. Avisar os casais nas novidades do app e no Instagram.

**B. Responder uma reclamação**
1. Responder em até 24 h, agradecendo.
2. Repetir o problema com as palavras da pessoa.
3. Dizer o que vai ser feito e quando; se não for mudar, dizer por quê.
4. Anotar o tema numa planilha de reclamações; três iguais viram tarefa da semana.
5. Cobrança errada: reembolsar primeiro, investigar depois.

**C. Pedido de dados ou exclusão (LGPD)**
1. Confirmar que quem pede é titular da conta.
2. Exportar ou apagar em até 15 dias (o app já tem "Apagar todos os dados"; ter também a exportação).
3. Registrar data, pedido e resposta.

**D. Revisão semanal (domingo, 30 min)**
1. Anotar os 3 números de `marketing.md` e as metas de `launch.md`.
2. Ler todas as respostas "o que mudaria" do suporte.
3. Escolher uma única coisa para mudar na semana.

## 5. Registros, licenças e seguros (confirmar cada um)
- [ ] **CNPJ como ME no Simples Nacional.** Desenvolvedor de software não pode ser MEI ([Contabilidade.com](https://contabilidade.com/blog/desenvolvedor-pode-ser-mei-em-2026-veja-como-abrir-seu-cnpj-corretamente-e-pagar-menos-impostos/)). Definir o CNAE com o contador; app por assinatura pode não ser "sob encomenda" (6201-5/01).
- [ ] Inscrição municipal e emissão de nota fiscal de serviço, conforme a prefeitura.
- [ ] Contas nas lojas no nome da empresa.
- [ ] **LGPD (Lei 13.709/2018):** política de privacidade e termos de uso, canal para os titulares, registro das operações. **Atenção: gestação e saúde são dados sensíveis** (art. 11), e dados de crianças têm regra própria (art. 14). Tratar dados sensíveis pode tirar a empresa das flexibilizações de pequeno porte da Resolução CD/ANPD nº 2/2022 ([Mattos Filho](https://www.mattosfilho.com.br/unico/resolucao-lgpd-agentes/), [Confidata](https://confidata.com.br/blog/lgpd-pequenas-empresas-resolucao-pequeno-porte)). Consultar advogado antes de lançar a área Família.
- [ ] Marca no INPI (`brand.md`).
- [ ] Publicidade com criadores identificada (#publi, CONAR).
- [ ] Seguro de responsabilidade civil e cibernético: avaliar com corretor quando houver receita.

## 6. Riscos
| # | Risco | Chance | Impacto | Plano |
|---|---|---|---|---|
| 1 | O parceiro não entra ou para de usar | alta | alto | convite e cutucar pelo WhatsApp; medir a entrada em 48 h; se < 50%, simplificar a entrada (web sem login) |
| 2 | O casal usa uma semana e esquece | alta | alto | guia da primeira semana, pergunta leve, resumo semanal; revisar no dia 14 |
| 3 | Ninguém paga (o painel deu 0%) | alta | alto | teste de casal fundador antes de gastar; se < 5 pagantes em 50 casais, rever a oferta |
| 4 | Vazamento ou incidente com dados sensíveis | baixa | muito alto | mínimo de dados de saúde; regras de acesso por casal; plano de resposta; comunicar a ANPD e os titulares conforme a lei |
| 5 | Loja recusa o app ou a cobrança | média | médio | seguir as diretrizes; cobrança só pelas lojas; política de privacidade publicada |
| 6 | Gestão da Casa ou um app gringo copia a área Família | média | médio | velocidade, conteúdo próprio em pt-BR, marca do fundador |
| 7 | Fundador sem tempo (trabalho de foto e vídeo) | média | alto | blocos fixos de 20 h/semana; cortar escopo, não qualidade |
| 8 | O placar gera briga | média | médio | linguagem de "carga" e "valeu"; opção de esconder o placar |
| 9 | Custo do servidor sobe com o uso | baixa | baixo | limite de gasto do Supabase; arquivar registros antigos (o app já apaga os do bebê com mais de 14 dias) |
| 10 | Avaliação ruim na loja logo no início | média | médio | pedir avaliação só depois de um momento bom (os dois responderam); responder toda avaliação |
