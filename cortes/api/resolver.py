"""Descobre o endereço real de um vídeo a partir do link (Twitch, Kick).

GET /api/resolver?url=<link>
Resposta: { titulo, duracao, thumb, origem, tipo: "hls"|"arquivo", variantes: [{id, altura, url}] }
Só aceita sites conhecidos (evita usar o servidor para buscar endereços arbitrários).
"""
import json
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import yt_dlp

PERMITIDOS = re.compile(r"(^|\.)(twitch\.tv|kick\.com)$")
YOUTUBE = re.compile(r"(^|\.)(youtube\.com|youtu\.be)$")


def resolver(url: str) -> dict:
    host = (urlparse(url).hostname or "").lower()
    if YOUTUBE.search(host):
        raise ValueError(
            "O YouTube bloqueia servidores. Baixe o vídeo (no YouTube Studio, se for seu) e suba o arquivo."
        )
    if not PERMITIDOS.search(host):
        raise ValueError("Por enquanto aceito links da Twitch e da Kick, ou um link direto para um arquivo .mp4/.m3u8.")
    opts = {"quiet": True, "skip_download": True, "noplaylist": True, "socket_timeout": 15}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    if info.get("_type") == "playlist":
        raise ValueError("Esse link é de uma lista. Cole o link de um vídeo só.")
    variantes = []
    for f in info.get("formats") or []:
        if not f.get("url") or f.get("vcodec") == "none":
            continue
        proto = f.get("protocol") or ""
        if f.get("acodec") == "none":
            continue  # precisa ter áudio junto
        variantes.append(
            {
                "id": f.get("format_id"),
                "altura": f.get("height") or 0,
                "fps": f.get("fps"),
                "url": f["url"],
                "hls": proto.startswith("m3u8"),
            }
        )
    if not variantes:
        raise ValueError("Não encontrei um formato de vídeo com áudio nesse link.")
    variantes.sort(key=lambda v: v["altura"])
    return {
        "titulo": info.get("title") or "vídeo",
        "duracao": info.get("duration"),
        "thumb": info.get("thumbnail"),
        "origem": info.get("extractor_key"),
        "tipo": "hls" if any(v["hls"] for v in variantes) else "arquivo",
        "variantes": variantes,
    }


class handler(BaseHTTPRequestHandler):
    def _send(self, code, body):
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        url = (q.get("url") or [""])[0].strip()
        if not re.match(r"^https?://", url):
            return self._send(400, {"erro": "Cole um link começando com https://"})
        try:
            return self._send(200, resolver(url))
        except ValueError as e:
            return self._send(400, {"erro": str(e)})
        except Exception as e:  # noqa: BLE001
            msg = str(e).replace("ERROR: ", "")
            return self._send(502, {"erro": "Não consegui abrir esse link: " + msg[:300]})
