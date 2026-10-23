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

## Layout

Mídia em tela cheia (opcionalmente em P&B), círculo na cor de destaque com aspas ou o logo da máscara,
etiqueta no canto superior direito, texto principal grande com barra vertical, assinatura em caixa alta
e barra na base. Tudo entra em sequência (zoom da mídia, etiqueta "digitada", círculo com mola,
palavras subindo em cascata) e sai no último meio segundo para o loop do Reels ficar suave.

## Formato do post

```json
{
  "mascara": "padrao",
  "midia": {"tipo": "foto", "src": "minha-pasta/foto.jpg"},
  "editoria": "Política",
  "etiqueta": "#Urgente",
  "lead": "Governo anuncia *corte de 10%* na conta de luz a partir de janeiro",
  "credito": "Foto: Agência Brasil",
  "pretoEBranco": false,
  "duracaoFoto": 8,
  "duracaoMaxima": 90
}
```

- `lead`: texto principal. Trechos entre `*asteriscos*` ficam na cor de destaque. O tamanho da fonte se ajusta ao comprimento.
- `etiqueta`: caixa no topo; se omitida, usa `#editoria`.
- `credito`: aparece na linha abaixo da assinatura, ao lado do @.
- `midia.src`: caminho relativo ao JSON, caminho dentro de `public/` ou URL `https://`.
- Foto vira vídeo com zoom lento (`duracaoFoto`, padrão 8 s). Vídeo usa a duração original, cortada em `duracaoMaxima` (padrão 90 s), com o áudio original.
- `pretoEBranco` sobrescreve a configuração da máscara para esse post.
- `mascara` pode ser o id de um arquivo em `mascaras/` ou o objeto completo.

## Máscaras

Cada máscara é um JSON em `mascaras/<id>.json`, com arquivos em `public/mascaras/<id>/`:

| Campo | Uso |
|---|---|
| `perfil.nome` | Assinatura em caixa alta abaixo do texto |
| `perfil.handle` | @ na linha de detalhe |
| `logo` (opcional) | Vai dentro do círculo; sem logo, o círculo mostra aspas |
| `pretoEBranco` | Mídia em P&B por padrão |
| `cores.destaque` | Círculo, barras e palavras destacadas |
| `cores.textoSobreDestaque` | Aspas dentro do círculo |
| `cores.etiquetaFundo` / `cores.etiquetaTexto` | Caixa da etiqueta |
| `overlayPng` (opcional) | PNG 1080×1920 transparente aplicado por cima de tudo |

Para criar uma nova: copie `mascaras/padrao.json`, troque os campos e coloque os arquivos na pasta correspondente
(há um `public/mascaras/padrao/logo.svg` de exemplo).

Os exemplos em `exemplos/` apontam para `public/exemplo/foto.jpg` e `public/exemplo/video.mp4`, que não são
versionados: coloque ali seus próprios arquivos de teste.

## Estrutura

```
src/Reel.tsx        composição: mídia, círculo, etiqueta, texto, assinatura e animações
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
