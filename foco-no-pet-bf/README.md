# Foco no Pet · Stories Black Friday (Remotion)

Vídeo vertical para Instagram Stories: 1080×1920, 30 fps, 25 s, H.264, sem áudio.
Saída: `out/foco-no-pet-bf.mp4`.

| Tempo | Cena |
|---|---|
| 0–4 s | Gancho: foto em tela cheia com zoom lento · "Black Friday Foco no Pet" · "Sem desconto. Com presente." |
| 4–9 s | Oferta: "Ensaio de Natal Pet" + 20 min de sessão · cenário natalino · 5 fotos tratadas |
| 9–13 s | Bônus do lote Black Friday: foto impressa na hora · R$ 50 de crédito pro ensaio de aniversário |
| 13–17 s | Escassez: "Só 15 vagas" · vendas de 23 a 30/11 · ensaios nos domingos 6 e 13/12 · Sobradinho |
| 17–20 s | Vale-presente válido até fev/2027 |
| 20–25 s | CTA: "Garanta sua vaga" + WhatsApp. A base fica livre para o sticker de link |

## Editar
Tudo fica em **`src/config.ts`**: textos, preço, datas, número de vagas, WhatsApp, cores (`colors.accent`: dourado `#D9B45A` ou vermelho `#D4283C`), duração de cada cena (`sceneSeconds`; a soma é a duração total), fotos e o ponto do rosto de cada foto (`photoFocus`).

Para trocar uma foto, coloque o arquivo em `public/photos/` e aponte o caminho em `CONFIG.photos`.

## Comandos
```bash
npm install          # uma vez
npm run studio       # preview interativo no navegador (Remotion Studio)
npm run stills       # PNG do frame central de cada cena em out/stills/ (com e sem guias de safe zone)
npm run render       # gera out/foco-no-pet-bf.mp4
```
Safe zones respeitadas: nada de texto nos 250 px do topo nem nos 340 px da base. No CTA, 420 px a mais ficam livres acima da base para o sticker de link.
