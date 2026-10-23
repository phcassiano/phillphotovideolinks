# Reels Notícias

Gera Reels de notícia (1080×1920, 30 fps, H.264 + AAC) a partir de **uma foto ou vídeo + manchete + lead**,
aplicando uma **máscara** (identidade visual do perfil/site). O motion graphics é feito com [Remotion](https://www.remotion.dev/).

Etapa atual: **passo 1 (template de vídeo)**. Ainda não há painel, Supabase, IA nem publicação no Instagram.

## Como usar

```bash
npm install
npm run studio                                  # editor visual com prévia ao vivo
npm run render -- exemplos/post-video.json      # gera out/post-video.mp4 e out/post-video-capa.jpg
```

Se o Chrome do Remotion não puder ser baixado, aponte para um Chromium local:
`REMOTION_BROWSER_EXECUTABLE=/caminho/do/chrome-headless-shell npm run render -- ...`

## Formato do post

```json
{
  "mascara": "padrao",
  "midia": {"tipo": "video", "src": "minha-pasta/clipe.mp4"},
  "pais": "BR",
  "editoria": "Política",
  "manchete": "PT vai à guerra",
  "mancheteDestaque": "contra Flávio?",
  "etiqueta": "Polêmica",
  "lead": "Pedro Rousseff diz que PT irá à guerra contra Flávio Bolsonaro.",
  "credito": "vídeo: @fonte",
  "duracaoFoto": 8,
  "duracaoMaxima": 90
}
```

- `midia.src`: caminho relativo ao JSON, caminho dentro de `public/` ou URL `https://`.
- Foto vira vídeo com zoom lento (`duracaoFoto`, padrão 8 s). Vídeo usa a duração original, cortada em `duracaoMaxima` (padrão 90 s), com o áudio original.
- Manchete com até ~26 caracteres no total fica em uma linha; acima disso, a parte destacada desce para a segunda linha. O tamanho da fonte se ajusta sozinho.
- `mascara` pode ser o id de um arquivo em `mascaras/` ou o objeto completo.

## Máscaras

Cada máscara é um JSON em `mascaras/<id>.json`, com arquivos em `public/mascaras/<id>/`:

| Campo | Uso |
|---|---|
| `perfil.nome`, `perfil.handle`, `perfil.avatar`, `perfil.verificado` | Faixa de identidade na base do card |
| `logo` | Selo redondo no canto do card |
| `cores.destaque` / `cores.textoDestaque` | Faixa da manchete e barra do lead |
| `cores.faixaPerfil` | Faixa da identidade |
| `cores.brilhoInferior` / `cores.brilhoSuperior` | Luzes do fundo |
| `overlayPng` (opcional) | PNG 1080×1920 transparente aplicado por cima de tudo |

Para criar uma nova: copie `mascaras/padrao.json`, troque os campos e coloque os arquivos na pasta correspondente.

## Estrutura

```
src/Reel.tsx        composição: fundo, cabeçalho, card, lead e animações
src/Root.tsx        registro da composição e cálculo da duração
src/tipos.ts        tipos de Noticia e Mascara
scripts/render.mjs  render por linha de comando (MP4 + capa)
mascaras/           máscaras disponíveis
exemplos/           posts de exemplo
```

## Próximos passos

1. Supabase: armazenamento das mídias, tabela de posts e máscaras.
2. Claude API: sugerir manchete, destaque, etiqueta, editoria e legenda a partir do lead.
3. Painel de envio com prévia e aprovação.
4. Legendas automáticas e trilha.
5. Publicação e agendamento via Instagram Graph API.
