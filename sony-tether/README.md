# Sony Tether (Android)

App para tablet Android ligado por cabo USB numa câmera Sony. Você fotografa na
câmera, e cada foto aparece no tablet na hora, já com o seu preset do Lightroom,
pronta para compartilhar.

## O que ele faz

- Conecta na câmera pelo cabo USB-C (OTG), sem internet.
- Cada foto tirada aparece na tela grande e nas miniaturas.
- **Preset do Lightroom**: importa `.xmp` (Lightroom Classic/CC), `.lrtemplate`
  (Lightroom antigo), `.dng` exportado pelo Lightroom Mobile ou um `.zip` com
  vários presets. O preset escolhido é aplicado em toda foto que chega, com
  controle de intensidade. Segure a foto para ver o original.
- **Compartilhar** a foto da tela ou todas da sessão (WhatsApp, Drive, e-mail…).
- Salva tudo na galeria: o arquivo da câmera em **Imagens/SonyTether/Originais**
  e a versão com preset em **Imagens/SonyTether** (JPEG de até 4096 px).

### Sobre os presets

O app reproduz os ajustes principais do Lightroom: balanço de branco, exposição,
contraste, realces, sombras, brancos, pretos, curvas de tons (geral e RGB),
curva paramétrica, HSL, vibração, saturação, color grading / divisão de tons e
vinheta. O resultado fica próximo do Lightroom, não idêntico: o motor é outro e
trabalha sobre o JPEG. Claridade, textura, remover névoa, granulado e perfis
criativos não são reproduzidos; o app avisa quando o preset usa algum deles.

## Preparar a câmera

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
- `PresetLook.kt`: transforma o preset numa tabela de cor 3D (LUT 33³) e aplica
  em cada pixel; `Darkroom.kt` decodifica, aplica e salva.
- O botão **Diagnóstico** mostra cada passo da conversa com a câmera, para
  copiar e mandar quando algo falha.

## Limitações desta versão

- O protocolo da câmera foi feito a partir do comportamento conhecido das Alpha
  e ainda precisa ser confirmado no seu modelo.
- O preset é uma aproximação do Lightroom (veja acima).
