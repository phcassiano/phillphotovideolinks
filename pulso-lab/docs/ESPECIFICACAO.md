# App de otimização para Windows — especificação

Levantamento feito a partir do vídeo curto (29 s) do canal **Mestres da Informática** que apresenta o
programa **HUB Pro** (v0.2.9, "grátis • sem anúncios"). O vídeo completo (19:19) está no canal do YouTube
e mostra mais telas do que este resumo; o que **não aparece** no vídeo curto está marcado como
_"não mostrado"_.

> **Importante:** a ideia é criar um app **nosso**, com nome, logo e identidade visual próprios.
> Usar o HUB Pro como referência de funcionalidades e de experiência, sem copiar marca, ícones ou textos.

Screenshots de referência: pasta [`referencias/`](referencias/).

---

## 1. O que o vídeo promete (transcrição)

> "Esse PC estava com nota 47 e em poucos minutos foi para 100. Esse programa limpa, otimiza, desinstala
> tudo de uma vez, descobre pendrive falsificado e instala seus programas em português depois de formatar
> o computador. Ele é totalmente gratuito, sem propaganda e foi eu mesmo quem criei. Ele chama HUB Pro e o
> vídeo completo está no nosso canal do YouTube."

Os pontos que vendem o app:

1. **Nota de saúde do PC (0–100)**, com um botão "Corrigir tudo".
2. **Limpeza** de arquivos inúteis (no vídeo, 18,7 GB liberados).
3. **Desinstalador em lote**, que remove vários programas de uma vez, em silêncio, e procura sobras.
4. **Detector de pendrive/cartão/HD externo falsificado** (que mente a capacidade).
5. **Assistente pós-formatação**, que instala os programas em português e aplica configurações.
6. Grátis, sem anúncios e em português.

---

## 2. Layout geral

- Janela escura (dark mode), com cantos arredondados no estilo do Windows 11 e destaques em azul/roxo
  (gradiente nos botões principais).
- **Menu lateral esquerdo** agrupado por seções:

| Seção | Itens |
|---|---|
| (topo) | **Painel**, **Pós-formatação**, **Programas** |
| MEU PC | Meu PC, Saúde dos discos, Bateria, Windows 11, Drivers, Rede |
| TESTES | Benchmark, Periféricos |
| OTIMIZAR | Limpeza, Mapa do disco, Arquivos duplicados, Otimizações, Desinstalador |
| (rodapé) | Seletor de idioma (Português (Brasil)), alternar tema, versão + "Verificar atualização" |

- Ícones `ⓘ` ao lado dos títulos e itens explicam cada coisa em linguagem simples (público leigo).
- Os textos explicam **o que vai acontecer** antes de cada ação, por exemplo: "Seus documentos, fotos e
  programas não são tocados".

---

## 3. Telas mostradas

### 3.1 Painel (tela inicial)
Referências: `00-painel-print.jpg`, `01-painel-nota-47.jpg`, `02-analisando.jpg`, `03-painel-nota-100.jpg`

- **Anel de nota** grande com o número (47) e o rótulo "saúde do PC". A cor muda conforme a nota:
  vermelho quando baixa, verde quando 100. Durante a análise, o anel vira "ANALISANDO" com ícone de lupa.
- Título dinâmico: "Seu PC precisa de atenção" / "Seu PC está em ótima forma".
- Subtítulo: "4 item(ns) para resolver. 'Corrigir tudo' apaga os arquivos inúteis e aplica os ajustes
  recomendados (dá para desfazer); o resto abre na tela certa."
- "Última análise: hoje às 19:29 · nota 47" + link **Ver histórico** (histórico de notas).
- **Checklist de verificações**, cada uma com status (✔ verde / ⚠ amarelo / ⊗ vermelho), uma linha de
  detalhe e os botões **Resolver** / **Ignorar**:

| Verificação | Exemplo de detalhe |
|---|---|
| Arquivos inúteis | "18,7 GB podem ser apagados" → "Quase nada para limpar" |
| Programas que abrem com o Windows | "4 programa(s) abrem junto com o Windows" |
| Ajustes recomendados do Windows | "8 ajuste(s) ainda não aplicados" → "Todos aplicados" |
| Drivers | "Nenhum aparelho com problema" |
| Saúde dos discos | "3 disco(s) em bom estado" |
| Espaço no disco do Windows | "10,3 GB livres (9%)" → "29,1 GB livres (25%)" |
| Programas desatualizados | "10 programa(s) com versão nova" → "Todos os programas em dia" |

- Botões: **Corrigir tudo** (primário) e **Analisar de novo**.
- **Card "Vídeo novo no canal"**: miniatura + título + "Publicado há 7 dias" + botão **Assistir** + fechar.
  (No nosso app: canal próprio ou novidades/dicas.)
- **Cards de resumo**: Memória RAM (anel com 30% · "9,6 GB de 31,9 GB"), Disco do Windows (anel com
  91% usado · "10,3 GB livres de 118,1 GB") e Sistema ("Windows 11 Pro 25H2 (build …)", CPU
  "Intel Xeon E5-2680 v4 @ 2.40GHz", "Ligado há 7 h 10 min").
- Seção **Ferramentas** abaixo (atalhos para as telas, não mostrado em detalhe).

### 3.2 Limpeza
Referências: `04-limpeza.jpg`, `05-limpeza-concluida.jpg`

- Descrição: "Libera espaço apagando arquivos que o PC não precisa mais. Seus documentos, fotos e
  programas não são tocados (a Lixeira só é esvaziada se você marcar)."
- "Como usar: 1) Clique em Analisar. 2) Escolha o que apagar (os recomendados já vêm marcados, ou use os
  botões Marcar). 3) Clique em Limpar selecionados."
- **Selos de risco** em cada categoria: `Seguro` (verde), `Moderado` (amarelo), `Avançado` (vermelho),
  `Recomendado` (azul).
- Barra **Marcar:** Recomendados · Seguros · Seguros + Moderados · Só avançados · Todos · Nenhum.
- Contador "8 marcado(s) · 13 GB liberados ao limpar".
- "24 GB encontrados", checkbox "Só o que tem algo para limpar", botões **Analisar** e
  **Limpar selecionados**.
- Ao limpar: animação circular (lixeira) com o selo "Limpando" e o rodapé "Limpando (6 de 9): Cache do
  Google Chrome…". Ao terminar: ✔ e o selo "18,7 GB liberados".

### 3.3 Desinstalador
Referências: `06-desinstalador.jpg`, `07-desinstalar-confirmacao.jpg`

- Abas: **Programas instalados** · **Bloatware do Windows**.
- Busca + filtros: Todos · Programas · Store · Recentes · Grandes | Ordenar: Nome · Tamanho · Data.
- Lista com checkbox, ícone, nome, selo de origem (`Store`/programa), editora, versão, tamanho, data,
  e ações por item (lixeira, abrir pasta).
- Rodapé: "21 item(ns): 0 programa(s) e 21 app(s) da Store · 3,2 GB" · **Limpar seleção** ·
  **Desinstalar selecionados (4) · 78,9 MB**.
- **Modal de confirmação**: "Desinstalar 4 programas? Libera cerca de 78,9 MB. Eles saem um de cada vez,
  na ordem da lista."
  - "Depois, procurar sobras:" **Seguro** (só o que tem o nome exato do programa) · **Moderado**
    (recomendado: + inicialização e atalhos) · **Avançado** (procura mais fundo; extras vêm desmarcados).
  - ☑ **Criar ponto de restauração antes**.
  - "Todos saem em silêncio, sem você precisar clicar em nada."

### 3.4 Saúde dos discos → Verificar se é original (capacidade falsa)
Referências: `08-pendrive-teste.jpg`, `09-pendrive-falsificado.jpg`

- Abas: **Saúde** (temperatura, desgaste, defeitos e avisos de falha do HD/SSD; só lê, nada é gravado) ·
  **Verificar se é original (capacidade falsa)**.
- Explicação: "Pendrives, cartões e HDs externos falsificados dizem ter 1 TB (ou mais), mas guardam só
  alguns GB: o que passa disso some ou apaga o que já estava lá. Só aparecem HD externo, pendrive e
  cartão; o disco do Windows e os discos internos nunca são testados."
- Escolha do **Dispositivo** em chips ("USB SanDisk 3.2Gen1 · Pendrive · 61,5 GB", "USB 3.0 Disk ·
  Pendrive · 31,5 TB") + Atualizar. Aviso: "Teste em andamento: não desconecte o dispositivo."
- **Teste rápido** (recomendado; confere mais de 1.000 pontos, com opção "Precisão máxima") e
  **Teste completo** (grava o dispositivo inteiro).
- Durante o teste: "Gravando os pontos de teste: conferindo…", barra de progresso, botão Parar e um
  **mapa em grade** (pontos testados do começo ao fim do dispositivo, verde = ok, vermelho = falhou).
- Resultado: "**FALSIFICADO: diz ter 31,5 TB, mas guarda só 54 GB.**" e uma barra hachurada mostrando
  quanto "guarda de verdade".
  - Pontos conferidos: "3 guardaram certo, 1456 não."
  - Velocidade medida: "Gravação 9,0 MB/s · leitura 21,5 MB/s"
  - Dados originais: "Tudo o que o teste mexeu foi devolvido e conferido." (o teste **não apaga** os
    dados do usuário)

### 3.5 Pós-formatação (assistente)
Referências: `10-pos-formatacao.jpg`, `11-pos-formatacao-final.jpg`

- "Siga as etapas na ordem. Dá para parar, reiniciar e continuar depois." (o progresso fica salvo)
- **Etapas** (stepper vertical):
  1. **Proteção**: ponto de restauração criado
  2. **Windows Update**: em dia (atualizações e drivers do Windows)
  3. **Ativação**: ativado (só verifica)
  4. **Limpar o Windows**: remover bloatware (nada marcado)
  5. **Programas**: escolher os programas a instalar
  6. **Configurações**: ajustes rápidos
  7. **Revisar e executar**: fila de itens
- Fila executada com cartão de progresso ("Instalando Adobe Acrobat Reader (2 de 7)", 45% → 91%) e
  status por item: `Feito`, `Feito (dá para desfazer)`, `Instalado (em português)`, `Baixando… 67,9 MB /
  90,5 MB`, `Instalando…`, `Na fila`. Botão **Parar**.
- Itens vistos:
  - Configurações: Acertar o relógio pela internet · Ícone "Este Computador" na Área de Trabalho ·
    Não perguntar das Teclas de Aderência
  - Programas: 7-Zip · Adobe Acrobat Reader · WhatsApp · AnyDesk · Lightshot · .NET Desktop Runtime 8 ·
    DirectX (bibliotecas antigas)

### 3.6 Não mostrado no vídeo curto
Programas (provavelmente o catálogo de instalação/atualização), Meu PC, Bateria, Windows 11 (ajustes),
Drivers, Rede, Benchmark, Periféricos, Mapa do disco, Arquivos duplicados e Otimizações. Abaixo há uma
proposta para cada uma; vale conferir o vídeo completo de 19 min para ajustar.

---

## 4. Como implementar cada função (Windows)

| Função | Como fazer |
|---|---|
| Nota de saúde | Soma ponderada das verificações (ex.: inúteis 15, inicialização 10, ajustes 15, drivers 15, discos 20, espaço 15, desatualizados 10). Guardar o histórico em SQLite/JSON local. |
| Arquivos inúteis | `%TEMP%`, `C:\Windows\Temp`, cache do Windows Update (`SoftwareDistribution\Download`), Delivery Optimization, miniaturas (`thumbcache_*.db`), relatórios de erro (WER), dumps, logs, caches de Chrome/Edge/Firefox, Lixeira (opcional). Cada categoria tem seu nível de risco. |
| Programas na inicialização | Chaves `HKCU/HKLM\...\Run`, pasta Startup, Agendador de Tarefas e `StartupApproved` (para desativar sem apagar). |
| Ajustes recomendados | Lista declarativa (chave de registro/comando + valor + **como desfazer**). Exemplos: desativar apps em segundo plano, telemetria básica, plano de energia, efeitos visuais. Sempre com desfazer. |
| Drivers | WMI `Win32_PnPEntity` com `ConfigManagerErrorCode != 0`. |
| Saúde dos discos | `Get-PhysicalDisk` / `Get-StorageReliabilityCounter` (temperatura, desgaste, erros) e SMART via WMI `MSStorageDriver_FailurePredictStatus`. |
| Espaço em disco | `GetDiskFreeSpaceEx` no drive do sistema. |
| Programas desatualizados | `winget upgrade` (já vem no Windows 10/11) e leitura da saída/JSON. |
| Desinstalador | Chaves `Uninstall` (HKLM, HKLM\WOW6432Node, HKCU) e `QuietUninstallString`; MSI com `msiexec /x {GUID} /qn`; apps da Store com `Get-AppxPackage \| Remove-AppxPackage`. Sobras: pastas em Program Files/AppData/ProgramData e chaves de registro com o nome do programa, em três níveis. |
| Ponto de restauração | `Checkpoint-Computer` (PowerShell) / WMI `SystemRestore.CreateRestorePoint`. Requer admin e Proteção do Sistema ligada (o app pode oferecer ligar). |
| Pendrive falsificado | Mesmo princípio do H2testw/F3: abrir `\\.\PhysicalDriveN` (só discos removíveis/USB, **nunca** o disco do sistema), sortear N pontos ao longo da capacidade anunciada, **ler e guardar** o conteúdo original de cada ponto, gravar um padrão único (com o número do setor e um hash), ler de volta e comparar, e por fim **restaurar** o original e conferir. Capacidade real = último ponto bom antes das falhas. Medir velocidade de leitura/gravação. Modo completo = gravar e conferir o dispositivo inteiro (avisar que demora). |
| Pós-formatação → programas | **winget** com `--silent --accept-package-agreements --accept-source-agreements --locale pt-BR` (catálogo curado de IDs, ex.: `7zip.7zip`, `Adobe.Acrobat.Reader.64-bit`, `AnyDeskSoftwareGmbH.AnyDesk`, `Skillbrains.Lightshot`, `Microsoft.DotNet.DesktopRuntime.8`, `Microsoft.DirectX`, WhatsApp via Store `9NKSQGP7F2NH`). Fila com progresso e status. |
| Pós-formatação → config | Relógio: `w32tm /resync`. Ícone "Este Computador": `HideDesktopIcons\NewStartPanel` `{20D04FE0-3AEA-1069-A2D8-08002B30309D}=0`. Teclas de aderência: `HKCU\Control Panel\Accessibility\StickyKeys Flags`. Cada uma com desfazer. |
| Windows Update / Ativação | `UsoClient`/API COM `Microsoft.Update.Session`; ativação via `SoftwareLicensingProduct` (WMI), só para ler o status. |
| Retomar depois de reiniciar | Salvar o estado da fila em arquivo e registrar uma tarefa `RunOnce` para reabrir o app. |
| Mapa do disco / duplicados | Varredura com tamanhos (treemap); duplicados por tamanho → hash parcial → hash completo. |
| Benchmark | CPU (cálculo em todos os núcleos), disco (leitura/gravação sequencial e 4K) e RAM. |
| RAM / CPU / uptime | `GlobalMemoryStatusEx`, WMI `Win32_Processor`, `GetTickCount64`. |

### Princípios de segurança (o HUB Pro passa essa confiança e vale manter)
- Tudo que muda o sistema **dá para desfazer** ou cria um ponto de restauração antes.
- Itens arriscados vêm **desmarcados**; selos Seguro/Moderado/Avançado em tudo.
- Nunca mexer em documentos, fotos ou no disco do Windows durante o teste de pendrive.
- Explicar em português simples o que cada botão faz, antes de fazer.
- Pedir privilégio de administrador (UAC) só quando precisar (manifesto `requireAdministrator` ou
  elevar só um processo auxiliar).

---

## 5. Stack recomendada (desenvolvendo no MacBook)

**Tauri 2 (Rust) + React/TypeScript + Tailwind.**

- A interface (React) pode ser desenvolvida e visualizada no Mac com dados simulados.
- O backend em Rust usa as APIs do Windows (crates `windows`/`wmi`/`winreg`) e chama PowerShell/winget
  quando for mais simples.
- Instalador pequeno (~5–10 MB) e sem runtime pesado, ao contrário do Electron.
- **Compilar o .exe**: GitHub Actions em `windows-latest` (gera o instalador MSI/NSIS a cada push).
- **Testar de verdade**: máquina virtual com Windows 11 no Mac (UTM ou Parallels; nos Macs com chip
  Apple, Windows 11 ARM roda apps x64 por emulação) ou num PC Windows.
- Atualização automática: plugin `tauri-plugin-updater` usando as Releases do GitHub.
- Assinatura de código (opcional, evita o aviso do SmartScreen): certificado de assinatura de código
  ou Azure Trusted Signing.

Alternativa 100% nativa: C# .NET 8 + WinUI 3 (visual mais "Windows", mas só compila e roda no Windows).

---

## 6. Plano de versões

1. **v0.1:** esqueleto Tauri, layout com menu lateral, tema escuro, Painel com dados reais de
   RAM/CPU/disco/uptime.
2. **v0.2:** Limpeza (análise + limpeza com níveis de risco) e nota de saúde com "Corrigir tudo".
3. **v0.3:** Desinstalador (programas + Store + bloatware, em lote, silencioso, sobras, ponto de
   restauração).
4. **v0.4:** Pós-formatação (stepper + winget + configurações + retomar depois de reiniciar).
5. **v0.5:** Saúde dos discos + teste de capacidade falsa.
6. **v0.6+:** Inicialização, ajustes do Windows, drivers, programas desatualizados, mapa do disco,
   duplicados, benchmark, bateria (`powercfg /batteryreport`), rede e periféricos.
