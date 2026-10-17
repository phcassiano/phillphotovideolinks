"""Gera carrossel.html: carrossel de 7 slides (4:5) da Foco no Pet, "5 motivos para agendar".
Imagens e vídeos são embutidos em base64 (o HTML funciona sozinho, em qualquer lugar).
Uso: python3 build.py  →  carrossel.html
"""
import base64
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / "assets"

# ---------- marca ----------
BRAND = "Foco no Pet"
HANDLE = "@foconopet.bsb"
PRIMARY, LIGHT, DARK = "#E15A0A", "#F58A4B", "#9E3F07"
LIGHT_BG, LIGHT_BORDER, DARK_BG = "#FBF4EC", "#EFE3D5", "#1A1714"
GRADIENT = f"linear-gradient(165deg, {DARK} 0%, {PRIMARY} 50%, {LIGHT} 100%)"
DOMINGO, HORARIO, LOCAL, CIDADE, WHATS = "18/10", "a partir das 7h", "Parque dos Jequitibás", "Sobradinho-DF", "(61) 99989-0604"
TOTAL = 7


def uri(name: str) -> str:
    mime = {"jpg": "image/jpeg", "png": "image/png", "webm": "video/webm"}[name.rsplit(".", 1)[1]]
    return f"data:{mime};base64," + base64.b64encode((A / name).read_bytes()).decode()


def progress(i: int, light: bool) -> str:
    pct = (i + 1) / TOTAL * 100
    track, fill, label = ("rgba(0,0,0,0.08)", PRIMARY, "rgba(0,0,0,0.3)") if light else ("rgba(255,255,255,0.12)", "#fff", "rgba(255,255,255,0.4)")
    return f"""<div style="position:absolute;bottom:0;left:0;right:0;padding:16px 28px 20px;z-index:10;display:flex;align-items:center;gap:10px;">
    <div style="flex:1;height:3px;background:{track};border-radius:2px;overflow:hidden;"><div style="height:100%;width:{pct}%;background:{fill};border-radius:2px;"></div></div>
    <span class="sans" style="font-size:11px;color:{label};font-weight:500;">{i + 1}/{TOTAL}</span></div>"""


def arrow(light: bool) -> str:
    bg, stroke = ("rgba(0,0,0,0.06)", "rgba(0,0,0,0.25)") if light else ("rgba(255,255,255,0.08)", "rgba(255,255,255,0.35)")
    return f"""<div style="position:absolute;right:0;top:0;bottom:0;width:48px;z-index:9;display:flex;align-items:center;justify-content:center;background:linear-gradient(to right,transparent,{bg});">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="{stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>"""


ICON = uri("icon.png")


def lockup(dark_text: bool = True, size: int = 30) -> str:
    color = DARK_BG if dark_text else "#fff"
    return f"""<div style="display:inline-flex;align-items:center;gap:8px;">
    <div style="width:{size}px;height:{size}px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
      <img src="{ICON}" style="width:{size * 0.8}px;height:{size * 0.8}px;"></div>
    <span class="sans" style="font-size:13px;font-weight:600;letter-spacing:0.5px;color:{color};">{BRAND}</span></div>"""


def media(src: str, pos: str = "50% 40%", height: int = 270, extra: str = "", video: bool = False) -> str:
    inner = (f'<video src="{uri(src)}" muted loop autoplay playsinline style="width:100%;height:100%;object-fit:cover;object-position:{pos};display:block;"></video>'
             if video else f'<img src="{uri(src)}" style="width:100%;height:100%;object-fit:cover;object-position:{pos};display:block;">')
    return f"""<div class="anim-media" style="position:absolute;top:22px;left:22px;right:22px;height:{height}px;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.18);">{inner}{extra}</div>"""


def text_block(num: str, title: str, body: str, light: bool, delay0: float = 0.2) -> str:
    c_title = DARK_BG if light else "#fff"
    c_body = "#6E655C" if light else "rgba(255,255,255,0.72)"
    c_num = PRIMARY if light else LIGHT
    return f"""<div style="position:absolute;left:0;right:0;bottom:0;padding:0 36px 52px;z-index:2;">
    <div class="anim serif" style="animation-delay:{delay0}s;font-size:26px;font-weight:300;color:{c_num};line-height:1;margin-bottom:8px;">{num}</div>
    <h2 class="anim serif" style="animation-delay:{delay0 + 0.15}s;font-size:29px;font-weight:600;letter-spacing:-0.4px;line-height:1.1;color:{c_title};margin-bottom:10px;">{title}</h2>
    <p class="anim sans" style="animation-delay:{delay0 + 0.3}s;font-size:14px;line-height:1.5;color:{c_body};">{body}</p></div>"""


def pill(text: str, bg: str, color: str, where: str) -> str:
    return f'<span class="sans" style="position:absolute;{where};font-size:11px;font-weight:600;padding:5px 12px;border-radius:20px;background:{bg};color:{color};">{text}</span>'


slides = []

# 1 — Capa (claro) · vídeo
slides.append(("light", True, f"""
{media('p13.webm', '50% 4%', 262, '<div style="position:absolute;bottom:12px;left:12px;background:rgba(255,255,255,0.92);border-radius:999px;padding:4px 12px 4px 4px;">' + lockup(True, 26) + '</div>', video=True)}
<div style="position:absolute;left:0;right:0;bottom:0;padding:0 36px 50px;z-index:2;">
  <span class="anim sans" style="animation-delay:0.15s;display:inline-block;font-size:10px;font-weight:600;letter-spacing:2px;color:{PRIMARY};margin-bottom:10px;">5 MOTIVOS PRA AGENDAR</span>
  <h1 class="anim serif" style="animation-delay:0.3s;font-size:31px;font-weight:600;letter-spacing:-0.5px;line-height:1.08;color:{DARK_BG};margin-bottom:10px;">Seu pet merece mais que 300 fotos <em style="color:{PRIMARY};">tremidas</em> no celular.</h1>
  <p class="anim sans" style="animation-delay:0.55s;font-size:14px;line-height:1.5;color:#6E655C;">Arrasta pro lado 👉 e veja por que um ensaio de verdade vale cada minuto.</p>
</div>"""))

# 2 — Motivo 1 (escuro) · vídeo
slides.append(("dark", True, media("fala-p12.webm", "50% 30%", 262, video=True)
               + text_block("01", "Eles crescem rápido demais.", "O filhote de hoje é o cachorrão de amanhã. Cada fase acontece uma vez só, e merece ficar registrada. 🥺", False)))

# 3 — Motivo 2 (claro) · antes e depois
ba = f"""<div style="position:absolute;top:22px;left:22px;right:22px;height:262px;display:flex;gap:10px;">
  <div class="anim-media" style="flex:1;position:relative;border-radius:16px;overflow:hidden;transform:rotate(-2deg);">
    <img src="{uri('p04.jpg')}" style="width:100%;height:100%;object-fit:cover;object-position:60% 50%;filter:blur(4px) brightness(0.55) saturate(0.5);transform:scale(1.15) rotate(4deg);">
    {pill('📱 Celular', 'rgba(0,0,0,0.75)', '#fff', 'top:10px;left:10px')}
  </div>
  <div class="anim-media" style="flex:1;position:relative;border-radius:16px;overflow:hidden;box-shadow:0 10px 26px rgba(0,0,0,0.2);animation-delay:0.25s;">
    <img src="{uri('p04.jpg')}" style="width:100%;height:100%;object-fit:cover;object-position:60% 50%;">
    {pill('📸 Ensaio', PRIMARY, '#fff', 'top:10px;left:10px')}
  </div></div>"""
slides.append(("light", False, ba + text_block("02", "Foto de celular não faz justiça.", "Luz profissional, fundo colorido e paciência pra arrancar aquela pose. O que o celular não entrega.", True)))

# 4 — Motivo 3 (escuro) · vídeo
slides.append(("dark", True, media("p01.webm", "55% 22%", 262, pill('📍 Parque dos Jequitibás', 'rgba(0,0,0,0.6)', '#fff', 'bottom:10px;left:10px'), video=True)
               + text_block("03", "O estúdio vai até ele.", f"Fundo colorido e luz de estúdio montados no {LOCAL}, em Sobradinho. Ao ar livre, num lugar que seu pet curte.", False)))

# 5 — Motivo 4 (claro) · grade
grid_items = [("p01.jpg", "62% 35%"), ("p13.jpg", "50% 18%"), ("p06.jpg", "45% 45%"), ("p04.jpg", "60% 50%"), ("p05.jpg", "35% 25%"), ("p02.jpg", "60% 35%")]
cells = "".join(
    f'<div class="anim-media" style="animation-delay:{0.06 * k:.2f}s;border-radius:12px;overflow:hidden;"><img src="{uri(n)}" style="width:100%;height:100%;object-fit:cover;object-position:{p};display:block;"></div>'
    for k, (n, p) in enumerate(grid_items))
grid = f'<div style="position:absolute;top:22px;left:22px;right:22px;height:262px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:8px;">{cells}</div>'
slides.append(("light", False, grid + text_block("04", "Todo porte, toda raça, todo jeitinho.", "Do lulu de óculos ao cane corso: cada personalidade vira foto. Bagunceiro, tímido ou modelo nato. 🐾", True)))

# 6 — Motivo 5 (escuro) · imagem do Gemini
slides.append(("dark", False, media("quadro.jpg", "50% 30%", 262, pill('imagem ilustrativa', 'rgba(0,0,0,0.55)', 'rgba(255,255,255,0.85)', 'bottom:10px;right:10px'))
               + text_block("05", "Uma lembrança pra pendurar na parede.", "2.000 fotos no rolo da câmera não substituem aquela que você vê todo dia. Um dia ela vai valer ouro. 🤍", False)))

# 7 — CTA (gradiente)
slides.append(("brand", False, f"""
<div style="position:absolute;inset:0;padding:0 36px 52px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;z-index:2;">
  <div class="anim" style="animation-delay:0.1s;margin-bottom:22px;">{lockup(False, 40)}</div>
  <span class="anim sans" style="animation-delay:0.2s;font-size:10px;font-weight:600;letter-spacing:2px;color:rgba(255,255,255,0.6);margin-bottom:10px;">AGENDA ABERTA</span>
  <h2 class="anim serif" style="animation-delay:0.3s;font-size:30px;font-weight:600;letter-spacing:-0.5px;line-height:1.08;color:#fff;margin-bottom:14px;white-space:nowrap;">Domingo tem ensaio. 📸</h2>
  <p class="anim sans" style="animation-delay:0.45s;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.88);margin-bottom:22px;">
    📅 Domingo, {DOMINGO} · {HORARIO}<br>📍 {LOCAL} · {CIDADE}<br>⏳ Quem chama primeiro escolhe o horário</p>
  <div class="anim sans" style="animation-delay:0.6s;display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:{LIGHT_BG};color:{DARK};font-weight:600;font-size:14px;border-radius:28px;margin-bottom:16px;">
    💬 WhatsApp {WHATS}</div>
  <p class="anim sans" style="animation-delay:0.75s;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.75);">Salva este post e manda pro humano que precisa ver 🐾<br><b style="color:#fff;">{HANDLE}</b></p>
</div>"""))

# ---------- montagem ----------
slide_html = []
for i, (kind, _video, body) in enumerate(slides):
    light = kind == "light"
    bg = LIGHT_BG if light else DARK_BG if kind == "dark" else GRADIENT
    last = i == TOTAL - 1
    slide_html.append(f'<div class="slide" data-video="{int(_video)}" style="background:{bg};">{body}{"" if last else arrow(light)}{progress(i, light)}</div>')

html = f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Foco no Pet · Carrossel</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,600&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *{{margin:0;padding:0;box-sizing:border-box}}
  body{{background:#EDE6DD;display:flex;justify-content:center;padding:28px 12px;font-family:'Outfit',sans-serif}}
  .serif{{font-family:'Fraunces',serif}} .sans{{font-family:'Outfit',sans-serif}}
  .ig-frame{{width:420px;background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,0.12);overflow:hidden}}
  .ig-header{{display:flex;align-items:center;gap:10px;padding:12px 14px}}
  .ig-avatar{{width:34px;height:34px;border-radius:50%;background:{PRIMARY};display:flex;align-items:center;justify-content:center}}
  .carousel-viewport{{width:420px;height:525px;overflow:hidden;position:relative;cursor:grab;touch-action:pan-y}}
  .carousel-track{{display:flex;height:100%;transition:transform .35s cubic-bezier(.2,.8,.2,1)}}
  .slide{{position:relative;width:420px;height:525px;flex:0 0 420px;overflow:hidden}}
  .ig-dots{{display:flex;justify-content:center;gap:4px;padding:10px 0 4px}}
  .ig-dots span{{width:6px;height:6px;border-radius:50%;background:#D9D2C8}} .ig-dots span.on{{background:{PRIMARY}}}
  .ig-actions{{display:flex;gap:14px;padding:6px 14px}} .ig-actions svg{{width:24px;height:24px}}
  .ig-caption{{padding:4px 14px 14px;font-size:13px;line-height:1.45;color:#262626}}
  .anim{{opacity:0;animation:up .7s cubic-bezier(.2,.8,.2,1) forwards}}
  .anim-media{{animation:pop .8s cubic-bezier(.2,.8,.2,1) both}}
  @keyframes up{{from{{opacity:0;transform:translateY(14px)}}to{{opacity:1;transform:none}}}}
  @keyframes pop{{from{{opacity:0;transform:scale(.94)}}to{{opacity:1;transform:none}}}}
</style></head><body>
<div class="ig-frame">
  <div class="ig-header"><div class="ig-avatar"><img src="{ICON}" style="width:26px;height:26px;background:#fff;border-radius:50%;padding:2px"></div>
    <div><div style="font-size:13px;font-weight:600">{HANDLE[1:]}</div><div style="font-size:11px;color:#8e8e8e">{LOCAL} · {CIDADE}</div></div></div>
  <div class="carousel-viewport"><div class="carousel-track">{''.join(slide_html)}</div></div>
  <div class="ig-dots">{''.join(f'<span class="{"on" if i == 0 else ""}"></span>' for i in range(TOTAL))}</div>
  <div class="ig-actions">
    <svg viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
    <svg viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 21l2.2-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg>
    <svg viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
    <svg viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="2" style="margin-left:auto"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></div>
  <div class="ig-caption"><b>{HANDLE[1:]}</b> 5 motivos pra agendar o ensaio do seu pet 🐾📸 Domingo ({DOMINGO}) no {LOCAL}, {HORARIO}. Chama no WhatsApp {WHATS}!
    <div style="font-size:10px;color:#8e8e8e;margin-top:6px;letter-spacing:.5px">HÁ 2 HORAS</div></div>
</div>
<script>
  const track = document.querySelector('.carousel-track'), vp = document.querySelector('.carousel-viewport');
  const dots = [...document.querySelectorAll('.ig-dots span')]; let idx = 0, x0 = null;
  const go = (i) => {{ idx = Math.max(0, Math.min({TOTAL - 1}, i)); track.style.transform = `translateX(${{-idx * 420}}px)`; dots.forEach((d, k) => d.classList.toggle('on', k === idx)); }};
  vp.addEventListener('pointerdown', (e) => {{ x0 = e.clientX; vp.setPointerCapture(e.pointerId); }});
  vp.addEventListener('pointerup', (e) => {{ if (x0 === null) return; const dx = e.clientX - x0; if (Math.abs(dx) > 30) go(idx + (dx < 0 ? 1 : -1)); else go(idx + (e.offsetX > 210 ? 1 : -1)); x0 = null; }});
  document.addEventListener('keydown', (e) => {{ if (e.key === 'ArrowRight') go(idx + 1); if (e.key === 'ArrowLeft') go(idx - 1); }});
</script>
</body></html>"""

(ROOT / "carrossel.html").write_text(html, encoding="utf-8")
print("carrossel.html:", round(len(html) / 1e6, 1), "MB")
