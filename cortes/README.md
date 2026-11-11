# Cortes · cortes.phillcassiano.com

Estúdio de cortes virais que roda no navegador (Chrome do computador).

- **Entrada:** arquivos de vídeo ou link (Twitch: lives salvas, clipes e destaques; Kick; link direto .mp4/.m3u8).
  O YouTube bloqueia servidores, então nesse caso é preciso baixar e subir o arquivo.
- **Análise:** volume (gritos), mudanças de imagem (ação) e fala transcrita com Whisper no navegador.
- **Saída:** MP4 vertical 1080x1920 com legenda karaokê, título, zoom/som nos picos, abertura, CTA,
  variações por corte e agenda (.ics/.csv).

## Estrutura
- `index.html`, `app.css`, `js/`: o site (sem build)
- `api/resolver.py`: descobre o endereço real do vídeo de um link (yt-dlp). Só aceita Twitch e Kick.
- `api/proxy.js`: Edge Function que repassa os pedaços do vídeo (os servidores da Twitch não liberam CORS).
  Só aceita servidores de vídeo conhecidos e pedidos vindos do próprio site.

Links de lives longas: a análise baixa uma versão leve (160p/360p) e os cortes baixam só os seus trechos
na qualidade escolhida. O tráfego do proxy conta na banda do plano da Vercel.
