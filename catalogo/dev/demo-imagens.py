# Gera as imagens da loja exemplo (Vértice Importados) em catalogo/demo/.
# São ilustrações próprias, desenhadas aqui, sem fotos ou logos de terceiros.
# Uso: python3 catalogo/dev/demo-imagens.py
import math, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "..", "demo")
os.makedirs(OUT, exist_ok=True)
F = "/usr/share/fonts/opentype/inter/"
def font(name, size): return ImageFont.truetype(F + name, size)
BLACK = "InterDisplay-Black.otf"; BOLD = "Inter-Bold.otf"; XB = "Inter-ExtraBold.otf"; SEMI = "Inter-SemiBold.otf"
RED = (214, 16, 32)

def hexrgb(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def shade(c, k): return mix(c, (0, 0, 0) if k < 0 else (255, 255, 255), abs(k))

def bg(w, h, top=(246, 246, 248), bottom=(226, 226, 232)):
    im = Image.new("RGB", (w, h), top)
    d = ImageDraw.Draw(im)
    for y in range(h): d.line([(0, y), (w, y)], fill=mix(top, bottom, y / h))
    return im

def shadow(im, box, radius=60, blur=40, alpha=90):
    s = Image.new("L", im.size, 0)
    ImageDraw.Draw(s).rounded_rectangle(box, radius, fill=alpha)
    s = s.filter(ImageFilter.GaussianBlur(blur))
    im.paste((40, 40, 50), (0, 0), s)

def gloss(layer, box, radius):
    # Brilho suave na diagonal, só dentro da forma.
    x0, y0, x1, y1 = box
    g = Image.new("L", layer.size, 0); gd = ImageDraw.Draw(g)
    for i in range(0, x1 - x0 + 400, 3):
        a = max(0, 60 - abs(i - (x1 - x0) * 0.35) * 0.25)
        gd.line([(x0 + i, y0), (x0 + i - 400, y1)], fill=int(a), width=3)
    m = Image.new("L", layer.size, 0); ImageDraw.Draw(m).rounded_rectangle(box, radius, fill=255)
    g = Image.composite(g, Image.new("L", layer.size, 0), m)
    layer.paste((255, 255, 255), (0, 0), g)

def lens(d, cx, cy, r, ring):
    d.ellipse([cx - r - 10, cy - r - 10, cx + r + 10, cy + r + 10], fill=ring)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(18, 18, 24))
    d.ellipse([cx - r * .55, cy - r * .55, cx + r * .55, cy + r * .55], fill=(34, 40, 62))
    d.ellipse([cx - r * .25 - 8, cy - r * .45, cx - r * .25 + 6, cy - r * .3], fill=(140, 150, 190))

def phone_back(im, x, y, w, h, color, kind="pro"):
    c = hexrgb(color) if isinstance(color, str) else color
    d = ImageDraw.Draw(im)
    rad = int(w * .17)
    d.rounded_rectangle([x - 6, y - 6, x + w + 6, y + h + 6], rad + 6, fill=shade(c, -.28))  # borda
    d.rounded_rectangle([x, y, x + w, y + h], rad, fill=c)
    gloss(im, (x, y, x + w, y + h), rad)
    ring = shade(c, -.12)
    if kind == "pro":      # plataforma em faixa no topo, 3 lentes
        d.rounded_rectangle([x + 14, y + 14, x + w - 14, y + h * .26], int(w * .12), fill=shade(c, .08))
        r = w * .1
        lens(d, x + w * .25, y + h * .085, r, ring); lens(d, x + w * .25, y + h * .195, r, ring); lens(d, x + w * .5, y + h * .14, r, ring)
        d.ellipse([x + w * .74, y + h * .07, x + w * .82, y + h * .11], fill=(250, 240, 210))
    elif kind == "air":    # faixa fina com uma lente
        d.rounded_rectangle([x + 14, y + 22, x + w - 14, y + h * .13], int(w * .08), fill=shade(c, .1))
        lens(d, x + w * .2, y + h * .075, w * .085, ring)
        d.ellipse([x + w * .4, y + h * .065, x + w * .45, y + h * .09], fill=(250, 240, 210))
    else:                  # base: duas lentes na vertical
        d.rounded_rectangle([x + 22, y + 22, x + w * .45, y + h * .25], int(w * .1), fill=shade(c, .08))
        lens(d, x + w * .24, y + h * .085, w * .085, ring); lens(d, x + w * .24, y + h * .19, w * .085, ring)
    # logotipo neutro: um círculo discreto
    d.ellipse([x + w / 2 - 22, y + h * .5 - 22, x + w / 2 + 22, y + h * .5 + 22], outline=shade(c, -.1), width=5)

def phone_front(im, x, y, w, h, frame, wall):
    d = ImageDraw.Draw(im)
    rad = int(w * .17)
    d.rounded_rectangle([x - 6, y - 6, x + w + 6, y + h + 6], rad + 6, fill=shade(hexrgb(frame), -.25))
    d.rounded_rectangle([x, y, x + w, y + h], rad, fill=(10, 10, 12))
    a, b = hexrgb(wall[0]), hexrgb(wall[1])
    scr = Image.new("RGB", (w - 24, h - 24))
    sd = ImageDraw.Draw(scr)
    for yy in range(h - 24): sd.line([(0, yy), (w, yy)], fill=mix(a, b, yy / (h - 24)))
    for k in range(5):
        sd.ellipse([w * (.1 + .17 * k) - 60, h * .55 - 60 + 40 * k, w * (.1 + .17 * k) + 160, h * .55 + 160 + 40 * k], fill=mix(a, (255, 255, 255), .12 + .03 * k))
    m = Image.new("L", scr.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 25, h - 25], rad - 10, fill=255)
    im.paste(scr, (x + 12, y + 12), m)
    d.rounded_rectangle([x + w * .36, y + 30, x + w * .64, y + 64], 17, fill=(0, 0, 0))  # ilha
    d.text((x + w / 2, y + h * .2), "9:41", font=font(SEMI, int(w * .2)), fill=(255, 255, 255), anchor="mm")

def save(im, name, q=80):
    im.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=q, method=6)

def product_phone(name, color, kind, wall, front=True):
    im = bg(1000, 1000)
    shadow(im, (300, 860, 760, 920), 30, 30, 120)
    if front: phone_front(im, 190, 170, 330, 690, color, wall)
    phone_back(im, 420 if front else 330, 120, 360, 740, color, kind)
    save(im, name)

def simple(name, draw):
    im = bg(1000, 1000); draw(im, ImageDraw.Draw(im)); save(im, name)

# ---------- Celulares ----------
P = {
  "iphone-17-pro-max-laranja": ("#d9733a", "pro", ("#ff9a5c", "#5a1d0c")),
  "iphone-17-pro-max-azul": ("#2b3d5c", "pro", ("#5b7dbd", "#0b1426")),
  "iphone-17-pro-prata": ("#d6d7da", "pro", ("#b9c7e8", "#36405c")),
  "iphone-air-azul": ("#bcd3e8", "air", ("#9fd0ff", "#1c3b66")),
  "iphone-air-dourado": ("#e9d7b5", "air", ("#ffd99a", "#6b4417")),
  "iphone-17-lavanda": ("#c9b8e3", "base", ("#d3b7ff", "#3a2466")),
  "iphone-17-salvia": ("#b7c4a6", "base", ("#c3e3a1", "#2c4a1e")),
  "iphone-16-preto": ("#3a3b3f", "base", ("#7b7b88", "#111116")),
  "iphone-16-ultramarino": ("#5f78d6", "base", ("#8aa2ff", "#16246b")),
  "iphone-15-pro-max-titanio": ("#b9b2a5", "pro", ("#d8c9a8", "#3b3326")),
  "iphone-14-pro-roxo": ("#5a4a68", "pro", ("#a084c6", "#21152e")),
  "iphone-13-meianoite": ("#232a36", "base", ("#5d6f96", "#0b0f18")),
  "iphone-13-rosa": ("#f2cfd2", "base", ("#ffb7c4", "#6a2234")),
}
for k, (c, kind, wall) in P.items(): product_phone(k, c, kind, wall)

# ---------- Acessórios, áudio, games, serviços ----------
def charger(im, d):
    shadow(im, (330, 760, 670, 820), 30, 25, 110)
    d.rounded_rectangle([340, 330, 660, 780], 60, fill=(250, 250, 252), outline=(214, 214, 220), width=4)
    d.rounded_rectangle([450, 520, 550, 556], 18, fill=(40, 40, 46))
    d.rectangle([420, 230, 450, 340], fill=(190, 190, 196)); d.rectangle([550, 230, 580, 340], fill=(190, 190, 196))
    d.text((500, 680), "20W", font=font(BOLD, 44), fill=(170, 170, 178), anchor="mm")
simple("carregador-20w", charger)

def cable(im, d):
    for i in range(7):
        r = 120 + i * 26
        d.arc([500 - r, 520 - r * .62, 500 + r, 520 + r * .62], 0, 360, fill=(248, 248, 250), width=16)
        d.arc([500 - r, 520 - r * .62, 500 + r, 520 + r * .62], 200, 330, fill=(220, 220, 226), width=6)
    for x, y in ((250, 250), (690, 760)):
        d.rounded_rectangle([x, y, x + 70, y + 150], 18, fill=(245, 245, 247), outline=(205, 205, 212), width=3)
        d.rounded_rectangle([x + 18, y - 36, x + 52, y + 6], 8, fill=(190, 190, 198))
simple("cabo-usbc", cable)

def case(im, d):
    shadow(im, (300, 860, 720, 920), 30, 30, 90)
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(layer)
    ld.rounded_rectangle([320, 120, 700, 880], 70, fill=(210, 225, 240, 110), outline=(170, 190, 210, 255), width=10)
    ld.rounded_rectangle([345, 145, 600, 360], 50, outline=(170, 190, 210, 230), width=6)
    ld.ellipse([400, 440, 620, 660], outline=(150, 160, 175, 255), width=10)
    ld.rectangle([505, 655, 515, 720], fill=(150, 160, 175, 255))
    im.paste(layer, (0, 0), layer)
simple("capinha-magsafe", case)

def film(im, d):
    shadow(im, (310, 860, 710, 920), 30, 30, 80)
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(layer)
    ld.rounded_rectangle([300, 120, 700, 880], 70, fill=(235, 245, 255, 150), outline=(30, 30, 36, 255), width=18)
    ld.polygon([(330, 160), (480, 160), (330, 420)], fill=(255, 255, 255, 140))
    ld.rounded_rectangle([440, 150, 560, 180], 14, fill=(30, 30, 36, 255))
    im.paste(layer, (0, 0), layer)
    d.text((500, 950), "Vidro 3D 9H", font=font(SEMI, 34), fill=(120, 120, 130), anchor="mm")
simple("pelicula-3d", film)

def powerbank(im, d):
    shadow(im, (320, 800, 700, 860), 40, 30, 110)
    d.rounded_rectangle([320, 260, 690, 800], 70, fill=(244, 244, 246), outline=(210, 210, 216), width=4)
    d.ellipse([400, 370, 610, 580], outline=(200, 200, 208), width=10)
    for i in range(4): d.ellipse([470 + i * 22, 680, 484 + i * 22, 694], fill=(60, 200, 110) if i < 3 else (210, 210, 216))
simple("powerbank-magsafe", powerbank)

def earbuds(im, d):
    shadow(im, (320, 800, 680, 860), 50, 30, 110)
    d.rounded_rectangle([320, 430, 680, 800], 110, fill=(250, 250, 252), outline=(214, 214, 220), width=4)
    d.line([(330, 520), (670, 520)], fill=(214, 214, 220), width=4)
    d.ellipse([485, 640, 515, 670], fill=(120, 220, 140))
    for x in (380, 540):
        d.ellipse([x, 200, x + 90, 300], fill=(250, 250, 252), outline=(214, 214, 220), width=4)
        d.rounded_rectangle([x + 28, 270, x + 62, 420], 18, fill=(250, 250, 252), outline=(214, 214, 220), width=4)
        d.ellipse([x + 20, 215, x + 46, 241], fill=(60, 60, 66))
simple("fone-bluetooth-anc", earbuds)

def speaker(im, d):
    im.paste(bg(1000, 1000, (30, 30, 34), (10, 10, 12)))
    d = ImageDraw.Draw(im)
    shadow(im, (180, 820, 820, 880), 40, 30, 160)
    d.rounded_rectangle([170, 300, 830, 820], 120, fill=(22, 22, 26), outline=(60, 60, 66), width=6)
    for cx in (330, 670):
        d.ellipse([cx - 135, 425, cx + 135, 695], fill=(14, 14, 16), outline=(120, 255, 60), width=10)
        d.ellipse([cx - 70, 490, cx + 70, 630], fill=(40, 40, 46))
    d.rounded_rectangle([300, 230, 700, 300], 30, fill=(40, 40, 46))
    d.text((500, 760), "300W", font=font(BLACK, 54), fill=(120, 255, 60), anchor="mm")
simple("caixa-som-300w", speaker)

def controller(im, d):
    shadow(im, (220, 760, 780, 820), 60, 30, 110)
    W = (250, 250, 252); O = (205, 205, 212)
    d.ellipse([170, 360, 470, 800], fill=W, outline=O, width=4); d.ellipse([530, 360, 830, 800], fill=W, outline=O, width=4)
    d.rounded_rectangle([270, 330, 730, 620], 120, fill=W, outline=O, width=4)
    d.rectangle([300, 345, 700, 600], fill=W)
    d.rounded_rectangle([400, 360, 600, 470], 30, fill=(30, 30, 36))
    for cx, cy in ((380, 600), (620, 600)): d.ellipse([cx - 55, cy - 55, cx + 55, cy + 55], fill=(30, 30, 36))
    for cx, cy in ((290, 470), (250, 510), (330, 510), (290, 550)): d.rectangle([cx - 18, cy - 18, cx + 18, cy + 18], fill=(70, 70, 78))
    for cx, cy, c in ((710, 450, (90, 200, 160)), (670, 495, (230, 100, 140)), (750, 495, (120, 140, 230)), (710, 540, (240, 130, 90))):
        d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], outline=c, width=6)
simple("controle-sem-fio", controller)

def watch(im, d):
    d.rounded_rectangle([400, 80, 600, 920], 60, fill=(40, 44, 54))
    shadow(im, (330, 700, 670, 760), 50, 30, 90)
    d.rounded_rectangle([320, 290, 680, 710], 100, fill=(28, 28, 32), outline=(150, 150, 158), width=12)
    d.rounded_rectangle([350, 320, 650, 680], 80, fill=(8, 8, 10))
    d.text((500, 460), "10:09", font=font(BOLD, 86), fill=(255, 255, 255), anchor="mm")
    d.arc([400, 520, 600, 660], 200, 340, fill=(255, 60, 90), width=14)
    d.rounded_rectangle([680, 420, 712, 520], 14, fill=(150, 150, 158))
simple("smartwatch", watch)

def screen_fix(im, d):
    phone_front(im, 330, 120, 340, 720, "#2b2b30", ("#2b3b66", "#0b0f1c"))
    d = ImageDraw.Draw(im)
    for a in range(0, 360, 40):
        x2, y2 = 470 + math.cos(math.radians(a)) * 260, 560 + math.sin(math.radians(a)) * 300
        d.line([(470, 560), (x2, y2)], fill=(230, 235, 245), width=3)
    d.ellipse([440, 530, 500, 590], outline=(230, 235, 245), width=3)
    d.rounded_rectangle([600, 760, 900, 900], 30, fill=RED)
    d.text((750, 830), "TELA NOVA", font=font(BLACK, 40), fill=(255, 255, 255), anchor="mm")
simple("troca-de-tela", screen_fix)

def battery(im, d):
    d.rounded_rectangle([250, 330, 700, 670], 50, outline=(40, 40, 46), width=26)
    d.rounded_rectangle([700, 440, 760, 560], 20, fill=(40, 40, 46))
    for i in range(4): d.rounded_rectangle([290 + i * 100, 370, 370 + i * 100, 630], 18, fill=(60, 200, 110))
    d.text((500, 790), "100% de saúde", font=font(XB, 52), fill=(40, 40, 46), anchor="mm")
simple("troca-de-bateria", battery)

def tradein(im, d):
    im.paste(bg(1000, 1000, (28, 6, 10), (8, 8, 10)))
    phone_back(im, 160, 200, 300, 620, "#3a3b3f", "pro")
    phone_back(im, 560, 160, 300, 620, "#d9733a", "pro")
    d = ImageDraw.Draw(im)
    d.polygon([(470, 470), (550, 470), (550, 430), (620, 510), (550, 590), (550, 550), (470, 550)], fill=RED)
    d.text((500, 900), "SEU USADO VALE DESCONTO", font=font(BLACK, 46), fill=(255, 255, 255), anchor="mm")
simple("avaliacao-usado", tradein)

# ---------- Logo ----------
def logo():
    im = Image.new("RGBA", (900, 260), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.polygon([(20, 40), (110, 40), (165, 170), (220, 40), (310, 40), (205, 230), (125, 230)], fill=RED)
    d.text((340, 120), "VÉRTICE", font=font(BLACK, 128), fill=(255, 255, 255), anchor="lm")
    d.text((346, 215), "I M P O R T A D O S", font=font(BOLD, 38), fill=RED, anchor="lm")
    im = im.crop(im.getbbox())
    im.save(os.path.join(OUT, "logo.webp"), "WEBP", quality=92, method=6)
logo()

# ---------- Banners (computador 1920×640 e celular 1080×1350) ----------
def banner(name, title, sub, cta, art, w, h):
    im = bg(w, h, (16, 16, 18), (6, 6, 8))
    d = ImageDraw.Draw(im)
    # faixas vermelhas na diagonal
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
    k = h * .9
    ld.polygon([(w * .66, 0), (w * .66 + k * .35, 0), (w * .66 + k * .35 - h * .45, h), (w * .66 - h * .45, h)] if w > h else [(0, h * .52), (w, h * .36), (w, h * .44), (0, h * .6)], fill=RED + (230,))
    ld.polygon([(w * .66 + k * .35 + 30, 0), (w * .66 + k * .35 + 60, 0), (w * .66 + k * .35 + 60 - h * .45, h), (w * .66 + k * .35 + 30 - h * .45, h)] if w > h else [(0, h * .64), (w, h * .48), (w, h * .5), (0, h * .66)], fill=(255, 255, 255, 60))
    lay = lay.filter(ImageFilter.GaussianBlur(1)); im.paste(lay, (0, 0), lay)
    if w > h:
        art(im, int(w * .68), int(h * .1), h / 640)
        x, y, s = int(w * .06), int(h * .2), h / 640
    else:
        art(im, int(w * .14), int(h * .52), h / 1350 * 1.25)
        x, y, s = int(w * .08), int(h * .07), w / 1080 * 1.18
    d = ImageDraw.Draw(im)
    for i, line in enumerate(title):
        d.text((x, y + i * 112 * s), line, font=font(BLACK, int(108 * s)), fill=(255, 255, 255) if i % 2 == 0 else RED)
    yy = y + len(title) * 112 * s + 24 * s
    d.text((x, yy), sub, font=font(SEMI, int(34 * s)), fill=(225, 225, 230))
    tw = d.textlength(cta, font=font(XB, int(30 * s)))
    d.rounded_rectangle([x, yy + 70 * s, x + tw + 64 * s, yy + 134 * s], 32 * s, fill=RED)
    d.text((x + 32 * s, yy + 102 * s), cta, font=font(XB, int(30 * s)), fill=(255, 255, 255), anchor="lm")
    im.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=82, method=6)

def art_trade(im, x, y, s):
    phone_back(im, int(x + 40 * s), int(y + 30 * s), int(200 * s), int(420 * s), "#3a3b3f", "pro")
    phone_back(im, int(x + 300 * s), int(y), int(200 * s), int(420 * s), "#d9733a", "pro")
def art_promo(im, x, y, s):
    for i, c in enumerate(("#2b3d5c", "#d6d7da", "#d9733a")):
        phone_back(im, int(x + i * 150 * s), int(y + (30 - i * 15) * s), int(190 * s), int(400 * s), c, "pro")
def art_fix(im, x, y, s):
    phone_front(im, int(x + 120 * s), int(y), int(220 * s), int(450 * s), "#2b2b30", ("#2b3b66", "#0b0f1c"))

for suffix, (w, h) in (("", (1920, 640)), ("-m", (1080, 1350))):
    banner("banner-troca" + suffix, ["COMPRAMOS", "SEU iPHONE"], "Avaliação na hora. Pagamento à vista ou na troca.", "QUERO AVALIAR O MEU", art_trade, w, h)
    banner("banner-quinta" + suffix, ["QUINTA", "MALUCA"], "Ofertas relâmpago toda quinta-feira.", "VER OFERTAS", art_promo, w, h)
    banner("banner-assistencia" + suffix, ["ASSISTÊNCIA", "TÉCNICA"], "Troca de tela e bateria no mesmo dia.", "AGENDAR NO WHATSAPP", art_fix, w, h)
print("imagens em", os.path.abspath(OUT), len(os.listdir(OUT)))
