# Motion Creator: skill de cortes virais e motion para o Claude

Esta skill faz duas coisas:
1. **Cortes**: você aponta uma pasta de vídeos (ex.: gameplays e lives de GTA 6) e ela acha os
   melhores momentos e entrega clipes verticais prontos, com teaser, título-gancho, legenda karaokê,
   zoom e som nos picos, CTA animado e um compilado "TOP N" para o YouTube.
2. **Motion**: cria vídeos animados do zero (roteiro → cenas → MP4) com 6 estilos, 21 tipos de
   cena, mascote, legendas e carrossel em PNG.

## Instalar

**Claude Code (recomendado, porque roda tudo na sua máquina):**
```bash
mkdir -p ~/.claude/skills
cp -r motion-creator ~/.claude/skills/
```
Depois, numa conversa: *"faz 5 cortes dos vídeos da pasta ~/Videos/gta6"*.

**claude.ai (app/web):** envie o `motion-creator.zip` em Configurações → Capacidades → Skills.
No app, o Claude roda num sandbox na nuvem. Para vídeos grandes, prefira o Claude Code.

## Requisitos
- Node.js 18+
- ffmpeg
- make + compilador C (para o whisper.cpp, que é instalado automaticamente na 1ª transcrição):
  - Mac: `xcode-select --install`
  - Windows: use WSL
- Licença do Remotion: grátis para pessoas físicas e empresas de até 3 pessoas.

## Estrutura
```
SKILL.md                 instruções que o Claude segue
references/              cortes, cenas, roteiro, estilos, mascote
scripts/                 novo-projeto, analisar, preparar-cortes, render, transcrever, sfx
template/                projeto Remotion (motor + composições MotionVideo, Corte, Compilado)
```
