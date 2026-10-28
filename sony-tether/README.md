# Revela (Android)

_Antes chamado Sony Tether._

App para tablet Android ligado por cabo USB numa câmera Sony, Canon ou Nikon, ou
recebendo pelo Wi-Fi (FTP) de qualquer câmera com essa função. Você fotografa na
câmera, e cada foto aparece no tablet na hora, já com o seu preset do Lightroom,
pronta para compartilhar.

## O que ele faz

- Conecta na câmera pelo cabo USB-C (OTG), sem internet, e **reconecta sozinho**
  quando o cabo solta ou a câmera desliga e liga de novo.
- Cada foto tirada aparece na tela grande e nas miniaturas.
- **Conferir o foco**: dois toques na foto vão para 100% (um pixel da foto por
  pixel da tela) no ponto tocado; pinça amplia, arrastar move. Ampliada, a tela
  carrega o trecho em resolução cheia. Deslize para o lado para trocar de foto.
- **Estrelas e favoritas**: ♥ e ★ no canto da foto. O filtro (Todas, Favoritas,
  3★ ou mais, 5★, Escondidas) vale para as miniaturas, para "Compartilhar" e para a galeria
  do cliente.
- **Esconder ou apagar fotos ruins**: ⊘ esconde a foto (some da tela, do
  compartilhamento e da galeria do cliente; para recuperar, use o filtro
  "Escondidas" e toque em 👁). 🗑 apaga do tablet o arquivo da câmera e a versão
  com preset, depois de confirmar; a cópia no cartão da câmera continua.
  Os mesmos botões ficam no painel, em **FOTO DA TELA**, e aparecem ao segurar
  uma miniatura.
- **Sessões por cliente**: cada sessão tem pasta própria
  (**Imagens/Revela/2026-10-25 Maria**) e os arquivos ficam com o nome do
  cliente (**Maria_001.jpg**, **Maria_002.jpg**…). Dá para reabrir uma sessão
  antiga, com as estrelas e favoritas.
- **Preset do Lightroom**: importa `.xmp` (Lightroom Classic/CC), `.lrtemplate`
  (Lightroom antigo), `.dng` exportado pelo Lightroom Mobile ou um `.zip` com
  vários presets. O preset escolhido é aplicado em toda foto que chega, com
  controle de intensidade. Segure a foto para ver o original.
- **Marca d'água**: logo (PNG) ou texto, com posição, tamanho e opacidade.
  Vai nas fotos compartilhadas e na galeria do cliente; os originais ficam sem.
- **Compartilhar** a foto da tela ou as do filtro (WhatsApp, Drive, e-mail…).
- **QR code para o cliente**: o tablet abre uma página com as fotos do filtro na
  rede Wi-Fi. O cliente aponta a câmera do celular para o QR code, vê as fotos,
  abre cada uma e baixa todas num .zip. Não precisa de internet nem de app.
- **Modo cliente**: só a foto, em tela cheia, sem botões. Para sair, segure o
  cadeado no canto por 2 segundos.
- Salva tudo na galeria: o arquivo da câmera em **Originais**, dentro da pasta
  da sessão, e a versão para compartilhar (preset e marca d'água, JPEG de até
  4096 px) na própria pasta da sessão.

### Galeria do cliente (QR code)

- O celular do cliente precisa estar **no mesmo Wi-Fi do tablet**, ou conectado
  ao **ponto de acesso (roteador) do tablet**, que funciona mesmo sem chip ou
  internet.
- O endereço tem um código aleatório: quem está na mesma rede não vê as fotos
  sem o QR code. A galeria fica no ar até você tocar em "Desligar galeria" ou
  fechar o app.
- Mostra as fotos do filtro atual. Marque as favoritas e escolha "Favoritas"
  para o cliente ver só as escolhidas.

### Sobre os presets

O app reproduz os ajustes principais do Lightroom: balanço de branco, exposição,
contraste, realces, sombras, brancos, pretos, curvas de tons (geral e RGB),
curva paramétrica, HSL, vibração, saturação, color grading / divisão de tons e
vinheta, e também claridade, textura, remover névoa e granulado. O resultado fica
próximo do Lightroom, não idêntico: o motor é outro e trabalha sobre o JPEG.
Perfis criativos não são reproduzidos; o app avisa quando o preset usa um.

No cartão do preset, uma **fileira de miniaturas** mostra a foto da tela com cada
preset importado: um toque troca o preset.

### Slideshow para TV

**Entregar → Slideshow para TV** mostra um endereço curto (ex.:
`http://192.168.0.12:8080/abc12345/tv`) para digitar no navegador de uma TV,
notebook ou tablet no mesmo Wi-Fi. As fotos aprovadas entram na tela assim que
chegam e as outras se revezam. Por padrão, só entram as **favoritas ♥**: o coração
é a sua aprovação. Também dá para escolher "todas as fotos".

### Sua marca

**Entregar → Sua marca na galeria**: nome do estúdio, Instagram, WhatsApp e logo
(o mesmo da marca d'água). Aparecem no topo da galeria do cliente, com botões de
contato, e no canto do slideshow.

### Moldura de recorte

**Foto da tela → Moldura** desenha por cima da foto o recorte de
Instagram 4:5, quadrado, Story/Reels 9:16 (com as faixas que o Instagram cobre),
capa de revista A4 (com o espaço do título) ou lâmina de álbum 2:1 (com a dobra no
meio). Serve só para enquadrar: a foto salva não é cortada.

## Assinatura

Na primeira instalação, o app tem **3 dias de teste grátis** (`LicenseManager.TRIAL_DAYS`),
registrados no servidor pelo código do tablet: reinstalar não começa um teste novo.
Depois, receber fotos (cabo e Wi-Fi) e entregar (compartilhar, QR code, slideshow) pedem
uma **chave de ativação**: painel → **Assinatura → Inserir chave**. As sessões e as fotos
já recebidas continuam acessíveis.

- A chave é ligada ao **código do tablet** (8 letras, aparece no cartão Assinatura) e tem
  data de validade. Chaves com aparelho `*` valem em qualquer tablet.
- As chaves são geradas no site (`/admin`), assinadas com uma chave privada que só o
  servidor tem; o app confere com a chave pública. Detalhes em `revela-site/README.md`.
- Chaves vendidas na Kiwify são ativadas pela internet e ficam ligadas ao primeiro tablet;
  as renovações chegam sozinhas quando o tablet tem internet.
- Chaves canceladas (reembolso, chargeback) são bloqueadas quando o tablet tem internet.
- Atrasar o relógio do tablet não estende a validade: o app usa o dia mais recente que já viu.

## Câmeras compatíveis

| Como | Câmeras | Observações |
|---|---|---|
| Cabo USB | **Sony** Alpha com "PC Remoto" (A7 III, A7R III em diante, A9, A1, A7 IV, A6xxx recentes…) | Conexão USB: PC Remoto |
| Cabo USB | **Canon EOS** de 2015 para cá (5D IV, 6D II, 80D/90D, R, RP, R5, R6, R7, R8, R10, R50, M50…) | Desligue o Wi-Fi/Bluetooth da câmera: com o sem fio ligado, a Canon desativa o USB |
| Cabo USB | **Nikon** de 2015 para cá (D500, D850, D780, D7500, Z5, Z6/Z7 e II/III, Z8, Z9, Zf, Z50…) | Se houver a opção USB, escolha MTP/PTP |
| Wi-Fi (FTP) | Qualquer câmera com transferência FTP (Sony A7R III/A9/A1/A7 IV, Canon R3/R5/R6 II/R7/R10, Nikon Z6III/Z8/Z9…) | Veja abaixo |

Pelo cabo, o app baixa cada foto gravada no cartão assim que você dispara (JPEG,
RAW ou os dois; vídeos ficam no cartão). Os RAW (.ARW, .CR2, .CR3, .NEF, .DNG)
aparecem na tela pela prévia que vem dentro do arquivo.

**Testado de verdade:** ainda nenhum modelo. A Sony foi feita a partir do
protocolo conhecido; a Canon e a Nikon seguem os comandos que o libgphoto2 usa.
Se algo falhar, mande o texto de **Diagnóstico**.

### Receber pelo Wi-Fi (FTP)

O app vira um servidor FTP: **Câmera → Receber pelo Wi-Fi (FTP)**, ligue e
configure a câmera com o servidor, a porta (2121), o usuário e a senha que
aparecem na tela. Use **modo passivo**, deixe o **protocolo seguro (FTPS)
desligado** e a pasta vazia, e ligue a **transferência automática**. A câmera e o
tablet precisam estar no mesmo Wi-Fi, ou a câmera conectada ao ponto de acesso do
tablet, que funciona sem internet. O app precisa ficar aberto.

## Preparar a câmera (exemplo: Sony A7R III)

Na A7R III (os nomes podem variar um pouco conforme o idioma do menu):

1. **MENU → Configuração (maleta) → Conexão USB → PC Remoto**.
2. **MENU → Rede → Função PC Remoto**:
   - **Destino de gravação da imagem estática → PC+Câmera**, para ficar com uma
     cópia no cartão (o padrão "Somente PC" não grava no cartão);
   - **Salvar imagem RAW+J no PC → Somente JPEG**, se a câmera estiver em
     RAW+JPEG: o tablet recebe só o JPEG (rápido e com resolução cheia para o
     preset) e o RAW fica no cartão.
3. Ligue o cabo na porta **USB-C** da câmera (é mais rápida que a micro-USB).

Em outras Alpha os passos são parecidos:

1. No menu da câmera, mude a **Conexão USB** para **PC Remoto** (em modelos
   novos: *Rede / Conexão → Função de disparo remoto → Ligado*, com
   *Método de conexão: USB*).
2. Em **Configurações do PC Remoto → Destino salvar img.**, escolha
   **Somente PC** ou **PC + Câmera** (para ter cópia no cartão também).
3. Em **Tamanho de imagem salvo** (se existir), prefira **JPEG** ou **RAW+JPEG**.
   O preset é aplicado sobre o JPEG; de uma foto só RAW o app usa a prévia
   embutida no arquivo, que tem resolução menor.

## Instalar no tablet

1. Copie o `Revela.apk` para o tablet e abra o arquivo.
2. Na primeira vez, o Android pede para **permitir instalar apps desta fonte**.
3. Ligue a câmera no tablet pelo cabo. O Android pergunta se quer abrir o
   Revela: marque "sempre" para ele abrir sozinho nas próximas vezes.

O APK é assinado com a chave em `keystore/`, então uma versão nova instala por
cima da antiga sem perder nada.

## Design

Tema escuro com destaque dourado, cartões e ícones do Material Symbols. Capturas
da tela ficam em `design/`; para gerar de novo (usa Robolectric, sem tablet):
`./gradlew testReleaseUnitTest --tests ScreenshotTest -Pscreenshots`.

## Gerar o APK

- Pelo GitHub: aba **Actions → "Revela: gerar APK" → Run workflow**. O APK
  fica em *Artifacts* no fim da execução.
- No computador, com o Android SDK instalado:
  `./gradlew assembleRelease` → `app/build/outputs/apk/release/app-release.apk`

## Como funciona por dentro

- `ptp/PtpUsb.kt`: o protocolo PTP pelo USB, igual nas três marcas.
- `SonyCamera.kt`: extensões "SDIO" da Sony (modo PC Remoto); `Cameras.kt`:
  Canon EOS (modo remoto e GetEvent), Nikon (GetEventEx/CheckEvent) e câmeras
  PTP genéricas (avisos de "objeto novo" pela porta de eventos do USB).
- `FtpServer.kt`: o servidor FTP que recebe as fotos pelo Wi-Fi.
- `CameraSession.kt`: thread única que conecta, destrava a conexão quando
  preciso e recebe as fotos.
- `Preset.kt` e `PresetLibrary.kt`: leitura e guarda dos presets.
- `Sessions.kt`: sessões, numeração dos arquivos, estrelas e favoritas (JSON na
  pasta do app).
- `ZoomImageView.kt`: zoom, gestos e o trecho em resolução cheia para o foco.
- `GalleryServer.kt` e `QrCode.kt`: a página para o cliente (servidor HTTP
  simples no tablet) e o gerador de QR code, sem bibliotecas externas.
- `Watermark.kt`: a marca d'água; `Brand.kt`: os seus dados na galeria.
- `LocalEffects.kt`: claridade, textura e granulado; `Frames.kt`: as molduras;
  `PresetStrip.kt`: a fileira de miniaturas dos presets.
- `PresetLook.kt`: transforma o preset numa tabela de cor 3D (LUT 33³) e aplica
  em cada pixel; `Darkroom.kt` decodifica, aplica e salva.
- O botão **Diagnóstico** mostra cada passo da conversa com a câmera, para
  copiar e mandar quando algo falha.

## Limitações desta versão

- O protocolo da câmera foi feito a partir do comportamento conhecido das Alpha
  e ainda precisa ser confirmado no seu modelo.
- O preset é uma aproximação do Lightroom (veja acima).
- A galeria do cliente usa HTTP simples na rede local (sem cadeado no
  navegador); serve para entregar as fotos no próprio ensaio, não pela internet.
- O zoom em resolução cheia funciona com JPEG. De foto só RAW, o app tem a prévia
  embutida no arquivo, que é menor.
- A claridade, a textura e o granulado aumentam o tempo de cada foto com preset
  (a imagem inteira é processada mais uma vez).
