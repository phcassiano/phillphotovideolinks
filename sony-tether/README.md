# Sony Tether (Android)

App para tablet Android ligado por cabo USB numa câmera Sony. Você fotografa na
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
  (**Imagens/SonyTether/2026-10-25 Maria**) e os arquivos ficam com o nome do
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
vinheta. O resultado fica próximo do Lightroom, não idêntico: o motor é outro e
trabalha sobre o JPEG. Claridade, textura, remover névoa, granulado e perfis
criativos não são reproduzidos; o app avisa quando o preset usa algum deles.

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

1. Copie o `SonyTether.apk` para o tablet e abra o arquivo.
2. Na primeira vez, o Android pede para **permitir instalar apps desta fonte**.
3. Ligue a câmera no tablet pelo cabo. O Android pergunta se quer abrir o
   Sony Tether: marque "sempre" para ele abrir sozinho nas próximas vezes.

O APK é assinado com a chave em `keystore/`, então uma versão nova instala por
cima da antiga sem perder nada.

## Design

Tema escuro com destaque dourado, cartões e ícones do Material Symbols. Capturas
da tela ficam em `design/`; para gerar de novo (usa Robolectric, sem tablet):
`./gradlew testReleaseUnitTest --tests ScreenshotTest -Pscreenshots`.

## Gerar o APK

- Pelo GitHub: aba **Actions → "Sony Tether: gerar APK" → Run workflow**. O APK
  fica em *Artifacts* no fim da execução.
- No computador, com o Android SDK instalado:
  `./gradlew assembleRelease` → `app/build/outputs/apk/release/app-release.apk`

## Como funciona por dentro

- `ptp/PtpUsb.kt` e `SonyCamera.kt`: a Sony não tem SDK oficial para Android,
  então o app fala direto o protocolo PTP pelo USB com as extensões "SDIO" da
  Sony (as mesmas que o libgphoto2 usa) e baixa cada foto do objeto `0xFFFFC001`.
- `CameraSession.kt`: thread única que conecta, destrava a conexão quando
  preciso e recebe as fotos.
- `Preset.kt` e `PresetLibrary.kt`: leitura e guarda dos presets.
- `Sessions.kt`: sessões, numeração dos arquivos, estrelas e favoritas (JSON na
  pasta do app).
- `ZoomImageView.kt`: zoom, gestos e o trecho em resolução cheia para o foco.
- `GalleryServer.kt` e `QrCode.kt`: a página para o cliente (servidor HTTP
  simples no tablet) e o gerador de QR code, sem bibliotecas externas.
- `Watermark.kt`: a marca d'água.
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
