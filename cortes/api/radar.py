"""Radar: lista os vídeos de um perfil público do TikTok com visualizações, curtidas e comentários.

GET /api/radar?perfil=@usuario&n=30
"""
import json
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import yt_dlp

USUARIO = re.compile(r"^@?([A-Za-z0-9._]{2,24})$")


def radar(perfil: str, n: int) -> dict:
    m = USUARIO.match(perfil.strip())
    if not m:
        m2 = re.search(r"tiktok\.com/@([A-Za-z0-9._]{2,24})", perfil)
        if not m2:
            raise ValueError("Digite o @ de um perfil do TikTok (ex.: @gta6brasil).")
        m = m2
    user = m.group(1)
    opts = {"quiet": True, "skip_download": True, "extract_flat": True, "playlistend": n, "socket_timeout": 15}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(f"https://www.tiktok.com/@{user}", download=False)
    videos = []
    for e in info.get("entries") or []:
        thumbs = e.get("thumbnails") or []
        videos.append(
            {
                "url": e.get("url") or f"https://www.tiktok.com/@{user}/video/{e.get('id')}",
                "titulo": (e.get("title") or e.get("description") or "")[:200],
                "views": e.get("view_count") or 0,
                "likes": e.get("like_count") or 0,
                "comentarios": e.get("comment_count") or 0,
                "compartilhamentos": e.get("repost_count") or 0,
                "data": e.get("timestamp"),
                "duracao": e.get("duration"),
                "thumb": thumbs[-1]["url"] if thumbs else None,
            }
        )
    return {"perfil": user, "nome": info.get("uploader") or info.get("title") or user, "videos": videos}


class handler(BaseHTTPRequestHandler):
    def _send(self, code, body):
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "public, max-age=600")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        perfil = (q.get("perfil") or [""])[0]
        try:
            n = max(5, min(60, int((q.get("n") or ["30"])[0])))
        except ValueError:
            n = 30
        try:
            return self._send(200, radar(perfil, n))
        except ValueError as e:
            return self._send(400, {"erro": str(e)})
        except Exception as e:  # noqa: BLE001
            msg = str(e).replace("ERROR: ", "")
            return self._send(502, {"erro": "Não consegui abrir esse perfil (ele existe e é público?). " + msg[:200]})
