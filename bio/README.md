# Link na bio

Página de links própria para substituir o Linktree: avatar, nome, bio e uma
lista de botões. Os cliques são contados no seu servidor, sem Google Analytics,
pixel ou qualquer serviço de terceiros.

- **`links.json` é o CMS.** Edite, salve, recarregue a página. Não precisa
  reiniciar nem rodar build.
- **Cada botão passa por `/go/:slug`**, que grava uma linha em `data/clicks.log`
  e responde com 302 para o destino.
- **`/stats`** (com login e senha do `.env`) mostra os cliques por link: hoje,
  7 dias, 30 dias e total, mais um gráfico diário.
- **Imagem de compartilhamento (`/og.png`)** gerada sozinha a partir do nome, bio
  e avatar, com todas as tags Open Graph e Twitter Card.
- Modo escuro automático (`prefers-color-scheme`), layout pensado primeiro para
  celular, nenhum JavaScript no navegador.

Requer **Node 20.12 ou mais novo**. A única dependência é o
[`@resvg/resvg-js`](https://github.com/yisibl/resvg-js), que transforma o SVG da
imagem OG em PNG.

## Rodar no seu computador

```bash
cd bio
npm install
cp .env.example .env        # ajuste STATS_USER e STATS_PASS
npm run dev                 # http://127.0.0.1:3000
```

## Editando o `links.json`

```json
{
  "profile": {
    "name": "Phill Cassiano",
    "tagline": "Photo e Video",
    "bio": "Equipamentos que eu uso e recomendo 📸",
    "avatar": "/avatar.jpg",
    "siteUrl": "https://links.seudominio.com.br",
    "lang": "pt-BR",
    "accent": "#e8613c"
  },
  "links": [
    { "title": "Instagram", "url": "https://instagram.com/...", "emoji": "📷", "slug": "instagram" },
    { "title": "Tripé profissional 2,1 m", "url": "https://meli.la/1BLc1vx", "emoji": "📐" }
  ]
}
```

| Campo | |
|---|---|
| `title`, `url` | Obrigatórios. Aceita `https://`, `http://`, `mailto:` e `tel:` (o resto é ignorado, inclusive `javascript:`). |
| `emoji` | Opcional, aparece à esquerda do botão. |
| `slug` | Opcional. Sem ele, o slug sai do título (`Tripé profissional 2,1 m` → `/go/tripe-profissional-2-1-m`). |
| `siteUrl` | Endereço público, usado nas tags OG e no rodapé da imagem. Se ficar vazio, o servidor usa o domínio da requisição. Preencha em produção. |
| `accent` | Cor de destaque (hex) da página, do `/stats` e da imagem OG. |
| `avatar` | Arquivo dentro de `public/`. Troque `public/avatar.jpg` por uma foto quadrada de pelo menos 400×400 para a imagem OG ficar nítida. |

> **Atenção ao slug:** os cliques são guardados pelo slug. Se você mudar o
> título de um link sem `slug` fixo, ele ganha um slug novo e a contagem começa do
> zero (a antiga continua no `/stats`, marcada como "removido do links.json").
> Para links importantes, defina `"slug"` e ele não muda mais.

Antes de subir uma alteração, `npm run check` valida o JSON e lista os slugs.
Se o JSON quebrar no meio de uma edição no servidor, a página continua no ar com
a última versão válida (e o erro aparece no log).

Para ver a imagem de compartilhamento sem subir o servidor: `npm run og` gera
`og-preview.png`.

## Como os cliques são contados

Cada clique vira uma linha em `data/clicks.log`:

```
2026-10-14T17:25:21.076Z	whatsapp
```

Só data/hora e slug. Nada de IP, user-agent ou cookie. Não entram na conta:

- requisições `HEAD` e pré-carregamentos do navegador (`Sec-Purpose: prefetch`);
- robôs e geradores de prévia (WhatsApp, Facebook, Telegram, Discord, Slack,
  crawlers, `curl`…), que abrem o link quando ele é colado numa conversa.

O `/stats` lê o log de forma incremental (só as linhas novas), então continua
rápido com centenas de milhares de cliques. Para zerar a contagem, apague ou
renomeie `data/clicks.log`. Para fazer backup, basta copiar o arquivo.

## Configuração (`.env`)

| Variável | Padrão | |
|---|---|---|
| `PORT` | `3000` | |
| `HOST` | `127.0.0.1` | Deixe assim atrás do Caddy/nginx. |
| `STATS_USER`, `STATS_PASS` | vazio | Login do `/stats`. Sem os dois, o `/stats` responde 503. |
| `DATA_DIR` | `data` | Pasta do `clicks.log`. |
| `STATS_TZ` | `America/Sao_Paulo` | Fuso usado para "hoje" e para os dias do gráfico. |

---

## Deploy numa VPS (Ubuntu/Debian)

Os exemplos usam `links.seudominio.com.br`. Troque pelo seu domínio e aponte um
registro **A** (e **AAAA**, se tiver IPv6) para o IP da VPS antes de começar.

### 1. Node e usuário do serviço

```bash
# Node 22 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

# usuário sem login só para rodar o app
sudo useradd --system --home /srv/linknabio --shell /usr/sbin/nologin linknabio
```

### 2. Código

```bash
sudo git clone https://github.com/phcassiano/phillphotovideolinks.git /srv/linknabio
cd /srv/linknabio/bio
sudo npm ci --omit=dev

sudo cp .env.example .env
sudo nano .env                       # STATS_USER / STATS_PASS de verdade
sudo mkdir -p data
sudo chown -R linknabio:linknabio data .env
sudo chmod 600 .env
```

Preencha `"siteUrl": "https://links.seudominio.com.br"` no `links.json`.

### 3. systemd

```bash
sudo cp deploy/linknabio.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now linknabio
systemctl status linknabio
curl -I http://127.0.0.1:3000/      # deve responder 200
```

Logs: `journalctl -u linknabio -f`.

### 4a. Proxy com Caddy (mais simples, HTTPS automático)

```bash
sudo apt-get install -y caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile   # troque o domínio
sudo systemctl reload caddy
```

Pronto: o Caddy emite e renova o certificado sozinho.

### 4b. Proxy com nginx + Certbot

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/linknabio   # troque o domínio
sudo ln -s ../sites-available/linknabio /etc/nginx/sites-enabled/linknabio
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d links.seudominio.com.br
```

O Certbot adiciona o bloco HTTPS e o redirecionamento de HTTP sozinho.

### 5. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

A porta 3000 fica só em `127.0.0.1`, não precisa liberar.

### Atualizando

- **Só links:** edite `/srv/linknabio/bio/links.json` direto no servidor (ou faça
  `git pull`). Não precisa reiniciar.
- **Código:** `cd /srv/linknabio && sudo git pull && cd bio && sudo npm ci --omit=dev && sudo systemctl restart linknabio`.

### Conferindo a prévia de compartilhamento

Depois do deploy, teste o link no
[depurador do Facebook](https://developers.facebook.com/tools/debug/) (ele
também força a atualização do cache do WhatsApp/Instagram) ou cole numa conversa
com você mesmo no WhatsApp. A URL da imagem leva `?v=<hash>`, que muda quando o
nome, a bio ou o avatar mudam, então as redes buscam a imagem nova.

### Backup

O único dado que importa é `data/clicks.log` (e o `links.json`, que já está no
git). Um cron diário resolve:

```bash
0 4 * * * cp /srv/linknabio/bio/data/clicks.log /root/backup/clicks-$(date +\%F).log
```

## Estrutura

```
bio/
├── links.json          ← o que você edita
├── server.js           ← rotas: /, /go/:slug, /stats, /og.png, arquivos de public/
├── lib/
│   ├── config.js       ← lê e valida o links.json (recarrega quando muda)
│   ├── clicks.js       ← grava e agrega o clicks.log
│   ├── render.js       ← HTML da página e do /stats
│   └── og.js           ← SVG da imagem OG → PNG
├── public/avatar.jpg
├── fonts/              ← Inter (SIL OFL), usada na imagem OG
├── scripts/            ← npm run check / npm run og
└── deploy/             ← systemd, Caddyfile, nginx.conf
```
