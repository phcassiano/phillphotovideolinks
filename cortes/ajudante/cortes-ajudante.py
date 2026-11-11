#!/usr/bin/env python3
"""
Ajudante do Cortes — baixa vídeos do YouTube pelo SEU computador e entrega ao site.

Como usar: deixe esta janela aberta e cole o link do YouTube no site Cortes.
Para fechar, feche esta janela (ou aperte Ctrl+C).

Na primeira vez ele instala sozinho o que precisa (yt-dlp, ffmpeg e Deno), uns 150 MB.
Só aceita pedidos vindos do site Cortes. Os vídeos ficam na pasta "CortesAjudante"
dentro da sua pasta pessoal e são apagados quando você fecha o ajudante.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

VERSAO = "1.0.0"
PORTA = 17890
PASTA = Path.home() / "CortesAjudante"
ORIGENS = re.compile(r"^https://(cortes\.phillcassiano\.com|cortes[a-z0-9-]*\.vercel\.app)$|^http://localhost(:\d+)?$|^http://127\.0\.0\.1(:\d+)?$")
SITES = re.compile(r"(^|\.)(youtube\.com|youtu\.be)$")
if os.environ.get("CORTES_AJUDANTE_QUALQUER_SITE") == "1":  # só para testes
    SITES = re.compile(r".")


def instalar_dependencias():
    faltam = []
    try:
        import yt_dlp  # noqa: F401
    except ImportError:
        faltam.append("yt-dlp")
    try:
        import yt_dlp_ejs  # noqa: F401  (scripts que o YouTube exige)
    except ImportError:
        faltam.append("yt-dlp[default]")
    try:
        import imageio_ffmpeg  # noqa: F401
    except ImportError:
        faltam.append("imageio-ffmpeg")
    try:
        import deno  # noqa: F401  (o YouTube exige um interpretador de JavaScript)
    except ImportError:
        faltam.append("deno")
    if faltam:
        print(f"Instalando {', '.join(faltam)} (só na primeira vez)...")
        cmd = [sys.executable, "-m", "pip", "install", "--user", "--upgrade", *faltam]
        if subprocess.call(cmd) != 0:  # Python "gerenciado pelo sistema" (alguns Linux/Homebrew)
            subprocess.check_call(cmd + ["--break-system-packages"])
        import site
        import importlib

        sp = site.getusersitepackages()
        if sp not in sys.path:
            sys.path.append(sp)
        importlib.invalidate_caches()


def atualizar_ytdlp():
    """O YouTube muda sempre; um yt-dlp desatualizado para de funcionar."""
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "--user", "--upgrade", "--quiet", "yt-dlp[default]"], timeout=180, check=False)
    except Exception:
        pass


JOBS = {}
TRAVA = threading.Lock()


def baixar(job_id, url, qualidade, de, ate):
    import yt_dlp
    import imageio_ffmpeg

    job = JOBS[job_id]
    destino = PASTA / job_id
    destino.mkdir(parents=True, exist_ok=True)

    def progresso(d):
        if d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            feito = d.get("downloaded_bytes") or 0
            job["prog"] = (feito / total) if total else job.get("prog", 0)
            job["etapa"] = "baixando"
        elif d.get("status") == "finished":
            job["etapa"] = "juntando áudio e vídeo"

    q = int(qualidade or 720)
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "outtmpl": str(destino / "video.%(ext)s"),
        "format": f"bv*[height<={q}][vcodec^=avc1]+ba[ext=m4a]/bv*[height<={q}]+ba/b[height<={q}]/b",
        "merge_output_format": "mp4",
        "ffmpeg_location": imageio_ffmpeg.get_ffmpeg_exe(),
        "progress_hooks": [progresso],
        "concurrent_fragment_downloads": 4,
    }
    try:
        import deno

        opts["js_runtimes"] = {"deno": {"path": deno.find_deno_bin()}}
    except Exception:  # noqa: BLE001
        pass
    if de is not None or ate is not None:
        opts["download_ranges"] = yt_dlp.utils.download_range_func(None, [(de or 0, ate or float("inf"))])
        opts["force_keyframes_at_cuts"] = False
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info.get("_type") == "playlist":
                raise ValueError("Esse link é de uma playlist. Cole o link de um vídeo só.")
            if info.get("is_live"):
                raise ValueError("Essa live ainda está acontecendo. Espere terminar para cortar.")
            job["titulo"] = info.get("title") or "video"
            job["duracao"] = info.get("duration")
            ydl.process_ie_result(info, download=True)
        arquivos = sorted(destino.glob("video.*"), key=lambda p: p.stat().st_size, reverse=True)
        if not arquivos:
            raise RuntimeError("O download terminou sem gerar arquivo.")
        job["arquivo"] = str(arquivos[0])
        job["tamanho"] = arquivos[0].stat().st_size
        job["inicio"] = de or 0
        job["status"] = "pronto"
        job["prog"] = 1
        print(f"Pronto: {job['titulo']} ({job['tamanho'] / 1e6:.0f} MB)")
    except Exception as e:  # noqa: BLE001
        msg = str(e).replace("ERROR: ", "")
        if "Sign in to confirm" in msg or "bot" in msg.lower():
            msg = "O YouTube pediu verificação. Abra o YouTube neste computador, assista um pouco e tente de novo."
        job["status"] = "erro"
        job["erro"] = msg[:400]
        print("Erro:", msg[:400])


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _origem_ok(self):
        o = self.headers.get("Origin") or ""
        return bool(ORIGENS.match(o)), o

    def _cors(self, origem):
        self.send_header("Access-Control-Allow-Origin", origem)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Expose-Headers", "Content-Length, X-Inicio")

    def _json(self, code, body, origem):
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self._cors(origem)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        ok, origem = self._origem_ok()
        self.send_response(204 if ok else 403)
        if ok:
            self._cors(origem)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self):
        ok, origem = self._origem_ok()
        if not ok:
            self.send_response(403)
            self.end_headers()
            return
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path == "/status":
            return self._json(200, {"ok": True, "versao": VERSAO}, origem)
        if u.path == "/baixar":
            url = q.get("url", "")
            host = (urlparse(url).hostname or "").lower()
            if not url.startswith("http") or not SITES.search(host):
                return self._json(400, {"erro": "O ajudante só baixa links do YouTube."}, origem)
            job_id = uuid.uuid4().hex[:12]
            num = lambda k: float(q[k]) if q.get(k) not in (None, "") else None  # noqa: E731
            JOBS[job_id] = {"status": "baixando", "prog": 0, "etapa": "abrindo o link"}
            print(f"Baixando: {url}")
            threading.Thread(target=baixar, args=(job_id, url, q.get("qualidade"), num("de"), num("ate")), daemon=True).start()
            return self._json(200, {"id": job_id}, origem)
        if u.path == "/job":
            job = JOBS.get(q.get("id", ""))
            if not job:
                return self._json(404, {"erro": "pedido não encontrado"}, origem)
            return self._json(200, {k: v for k, v in job.items() if k != "arquivo"}, origem)
        if u.path == "/arquivo":
            job = JOBS.get(q.get("id", ""))
            if not job or job.get("status") != "pronto":
                return self._json(404, {"erro": "arquivo não está pronto"}, origem)
            caminho = Path(job["arquivo"])
            self.send_response(200)
            self._cors(origem)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Content-Length", str(caminho.stat().st_size))
            self.send_header("X-Inicio", str(job.get("inicio", 0)))
            self.end_headers()
            with open(caminho, "rb") as f:
                shutil.copyfileobj(f, self.wfile, 1024 * 1024)
            return
        return self._json(404, {"erro": "não encontrado"}, origem)


def main():
    print(f"Ajudante do Cortes {VERSAO}")
    instalar_dependencias()
    threading.Thread(target=atualizar_ytdlp, daemon=True).start()
    shutil.rmtree(PASTA, ignore_errors=True)  # limpa sobras de uma sessão anterior
    PASTA.mkdir(exist_ok=True)
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORTA), Handler)
    except OSError:
        print(f"A porta {PORTA} já está em uso. O ajudante já está aberto em outra janela?")
        input("Aperte Enter para fechar.")
        return
    print("\nPronto! Deixe esta janela aberta e cole o link do YouTube no site Cortes.\n")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        shutil.rmtree(PASTA, ignore_errors=True)
        print("Ajudante fechado.")


if __name__ == "__main__":
    main()
