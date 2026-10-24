# Sony Tether (Android)

App para tablet Android que controla uma câmera Sony pelo cabo USB, no estilo do
"Disparo remoto" do Imaging Edge: dispara pelo tablet, ajusta a exposição, mostra
o ao vivo e recebe cada foto na hora.

## O que ele faz

- Conecta na câmera pelo cabo USB-C (OTG), sem internet.
- Disparo pelo tablet, com foco automático (meio aperto e disparo).
- Ajustes: velocidade, abertura, ISO, compensação de exposição e balanço de branco.
- Ao vivo (live view) na tela grande.
- Cada foto, disparada pelo tablet ou pelo botão da câmera, chega no app,
  aparece na tela por alguns segundos e vai para as miniaturas.
- As fotos ficam salvas em **Imagens/SonyTether**. RAW (.ARW) que a galeria não
  aceitar vai para **Downloads/SonyTether**.

## Preparar a câmera

1. No menu da câmera, mude a **Conexão USB** para **PC Remoto** (em modelos
   novos: *Rede / Conexão → Função de disparo remoto → Ligado*, com
   *Método de conexão: USB*).
2. Em **Configurações do PC Remoto → Destino salvar img.**, escolha
   **Somente PC** ou **PC + Câmera** (para ter cópia no cartão também).
3. Em **Tamanho de imagem salvo** (se existir), prefira **RAW+JPEG** ou **JPEG**:
   o JPEG é o que aparece rápido na tela.

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

A Sony não tem SDK oficial para Android, então o app fala direto o protocolo PTP
pelo USB (`ptp/PtpUsb.kt`) com as extensões "SDIO" da Sony (`SonyCamera.kt`):
o aperto de mão do PC Remoto, a leitura de todos os ajustes de uma vez, o
disparo pelos botões virtuais e a foto e o ao vivo nos objetos `0xFFFFC001` e
`0xFFFFC002`. É o mesmo caminho que o libgphoto2 usa. Uma única thread
(`CameraSession.kt`) conversa com a câmera, e a tela fica em `MainActivity.kt`.

## Limitações desta primeira versão

- Ainda não foi testado com uma câmera de verdade: o protocolo foi feito a partir
  do comportamento conhecido das Alpha. Se algum ajuste ou o ao vivo não
  funcionar no seu modelo, a mensagem na tela ajuda a corrigir.
- Os botões ◀ ▶ andam um passo na lista que a própria câmera manda. Ajustes
  travados pelo modo (por exemplo, velocidade no modo A) aparecem apagados.
- O RAW é salvo inteiro, mas a tela mostra a prévia JPEG que vem dentro dele.
- Ainda não há edição nem presets (a parte "Evoto"). Isso fica para a próxima etapa.
