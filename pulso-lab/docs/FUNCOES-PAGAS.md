# Funções pagas de outros apps que valem entrar no Pulso Lab (de graça)

Pesquisa feita em novembro de 2026 nas versões pagas de CCleaner Professional, Advanced SystemCare Pro
(IObit), AVG TuneUp, Wise Care 365 Pro, Glary Utilities Pro, Revo Uninstaller Pro, Driver Booster Pro
(IObit), Ashampoo WinOptimizer e nos "game boosters" (Razer Cortex, Smart Game Booster).

As listas de recursos e os preços mudam entre versões e regiões, e boa parte das fontes é de revisores
e lojas. Por isso, a tabela diz **qual tipo de função** os pagos cobram, e não o recurso exato de cada
versão.

## Vale incluir

| # | Função | Quem cobra por ela | Como fazer no Pulso Lab | Versão |
|---|---|---|---|---|
| 1 | **Manutenção automática agendada** (limpeza toda semana, sem abrir o app) | CCleaner Pro, Glary Pro, Wise Care Pro, AVG TuneUp | Tarefa no Agendador de Tarefas do Windows rodando o Pulso Lab em modo silencioso (`--manutencao`), só com itens **Seguros**; notificação do Windows no fim ("1,2 GB liberados") | 0.3 |
| 2 | **Atualizador de programas** (todos de uma vez) | CCleaner Pro, AVG TuneUp | `winget upgrade --all` com lista para escolher, opção de ignorar um programa e verificação semanal automática | 0.4 |
| 3 | **Backup e restauração de drivers** | Driver Booster Pro | `pnputil /export-driver * <pasta>` para salvar e `pnputil /add-driver <pasta>\*.inf /install` para restaurar. Muito útil antes de formatar | 0.4 (Pós-formatação) |
| 4 | **Atualização de drivers** | Driver Booster Pro, CCleaner Pro | **Só** pelo Windows Update (catálogo de drivers da Microsoft) e links para o site do fabricante. Não baixar drivers de terceiros, que é a parte arriscada desses apps | 0.6 |
| 5 | **"Modo de suspensão" de apps** em segundo plano | AVG TuneUp (Sleep Mode) | Colocar processos escolhidos no **Modo de eficiência** do Windows 11 (EcoQoS + prioridade baixa), que é a mesma coisa que o Gerenciador de Tarefas faz. Reversível e sem fechar nada | 0.6 |
| 6 | **Monitor em tempo real e alertas** | CCleaner Pro, Advanced SystemCare Pro | Ícone perto do relógio, com avisos de disco quase cheio, disco com defeito (SMART), app usando muita memória e "PC ligado há 14 dias". Liga e desliga nas configurações | 0.5 |
| 7 | **Limpeza de privacidade ao desligar** | Glary Pro, Wise Care Pro | Opção "Limpar histórico e cache dos navegadores ao desligar" via tarefa agendada no evento de logoff | 0.3 |
| 8 | **Regras de limpeza personalizadas** | Wise Care Pro | Adicionar pastas próprias para limpar e pastas protegidas (que nunca são tocadas) | 0.2 |
| 9 | **Desinstalação forçada** (programa quebrado que não sai) | Revo Uninstaller Pro | Quando o desinstalador oficial falha: procurar pelo nome em Program Files, AppData, ProgramData, registro, serviços e tarefas, mostrar tudo e apagar só o que a pessoa marcar, com ponto de restauração antes | 0.3 |
| 10 | **Monitor de instalação** (desfazer 100% depois) | Revo Uninstaller Pro | "Instalar com o Pulso Lab": foto das pastas e do registro antes e depois, guardando o que mudou para remover tudo depois | 0.6+ |
| 11 | **Histórico de alterações com desfazer** (backup em vários níveis) | Revo Uninstaller Pro, Advanced SystemCare | Cada ajuste guarda o valor anterior num registro local. Tela "Histórico" com o botão Desfazer por item, além do ponto de restauração | 0.2 |
| 12 | **Modo Jogo** | Smart Game Booster (versão paga ativa sozinho), Razer Cortex | Ao abrir um jogo (lista de jogos do Steam, Epic e Xbox): plano de energia de alto desempenho, apps em segundo plano em modo eficiência, notificações pausadas. Tudo volta ao normal ao fechar o jogo. Avisar que o ganho costuma ser pequeno (de 1 a 10 FPS, segundo testes) | 0.6+ |
| 13 | **Apagar arquivo com segurança** (triturador) | Ashampoo WinOptimizer | Sobrescrever o arquivo antes de apagar (em HD). Em SSD, explicar que o TRIM já resolve e usar `cipher /w` para o espaço livre | 0.6 |
| 14 | **Atalhos no menu do botão direito** | Wise Care Pro | "Apagar com segurança" e "Ver o que ocupa espaço nesta pasta" no menu do Explorador | 0.6+ |
| 15 | **Relatório para o técnico** (no lugar de "suporte prioritário") | Todos os pagos | Botão "Copiar relatório do PC": hardware, Windows, nota, problemas e últimos erros, em texto, para mandar por WhatsApp ou e-mail | 0.6 |

## Não vale incluir (e por quê)

- **Limpador de registro:** quase não muda a velocidade e pode quebrar programas. O Pulso Lab só
  remove do registro as sobras de programas desinstalados (item 9), com confirmação.
- **"Liberador de RAM"** (esvaziar a memória em espera): o Windows já faz isso sozinho. Esvaziar à
  força deixa os programas mais lentos para reabrir.
- **Antivírus / "proteção contra spyware em tempo real":** o Microsoft Defender já vem no Windows e
  é bom. Em vez disso, o Painel pode **verificar se o Defender está ligado e atualizado**.
- **Desfragmentar SSD:** desgasta o SSD sem ganho. O Windows já otimiza sozinho (TRIM). Só faz sentido
  em HD, e o Windows também já agenda isso.
- **Baixar drivers de sites de terceiros:** risco de driver errado ou instalador alterado (veja o
  item 4).

## Diferencial do Pulso Lab

O que os outros cobram por ano (de US$ 20 a US$ 45, segundo os revisores), o Pulso Lab oferece de
graça, sem anúncios e em português, com três regras:

1. Tudo explicado antes de fazer.
2. Tudo com Desfazer ou ponto de restauração.
3. Nada de números inflados ("seu PC tem 2.341 problemas!"): a nota mostra só problemas reais.
