# Foco no Pet · Reels "Seu pet na capa" (Remotion)

Reels 1080×1920, 30 fps, 21 s, H.264 + efeitos sonoros (sem música, para você colocar um áudio em alta no Instagram).
Objetivo: vender ensaios e agendamentos para o próximo domingo. Saída: `out/foco-no-pet-domingo.mp4`.

| Tempo | Cena | Função |
|---|---|---|
| 0–3 s | O cane corso em tela cheia com o título "FOCO" de revista: "Domingo agora seu pet vira **capa de revista** 📸" | Gancho: flash de câmera e promessa clara |
| 3–10,5 s | 5 capas da revista "FOCO no Pet" entrando no ritmo (ESTILO, SORRISO, OLHAR, ATITUDE, TOCA AQUI) | Prova visual e desejo; formato que o pessoal compartilha |
| 10,5–14 s | Como garantir: 1. chama no WhatsApp · 2. escolhe o horário de domingo · 3. seu pet vira capa | Tira a fricção |
| 14–17 s | Calendário carimbando: "Neste DOMINGO 18/10 · Sobradinho-DF · agenda aberta, horários por ordem de agendamento" | Urgência sem inventar números |
| 17–21 s | Capa vazia "SEU PET AQUI?" + "Comenta **CAPA** 👇 que a gente te manda os horários" + WhatsApp | Comentário com palavra-chave (impulsiona o alcance) e contato direto |

## Toda semana
Edite **`src/config.ts`**: troque `domingo` (ex.: `'25/10'`) e, se quiser, as capas, os textos, as cores ou os tempos. Depois:

```bash
npm install          # uma vez
npm run studio       # assistir e ajustar no navegador
npm run stills       # PNG do meio de cada cena em out/stills/ (com e sem guias de safe zone)
npm run render       # gera os efeitos (public/sfx.wav) e out/foco-no-pet-domingo.mp4
```
Para trocar fotos: coloque em `public/photos/` e aponte em `CONFIG.hook.photo` / `CONFIG.capas[].photo`; ajuste `focus` (0 a 1) se o rosto sair cortado.

Safe zones do Reels respeitadas: nada nos 220 px do topo, nos 420 px da base (legenda e botões) nem nos 130 px da direita (curtir, comentar, compartilhar).

## Legenda sugerida
> Domingo agora seu pet vira capa de revista 📸🐾
>
> Ensaio Foco no Pet neste domingo (18/10) em Sobradinho-DF. Agenda aberta, horários por ordem de agendamento.
>
> 👇 Comenta **CAPA** que a gente te manda os horários
> 📲 Ou chama no WhatsApp (61) 99989-0604
>
> Marca quem tem um pet que merece ser capa! 🐶
>
> #FocoNoPet #EnsaioPet #FotografiaPet #PetLovers #Cachorro #DogsOfInstagram #Sobradinho #Brasilia #DF
