import math, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

UP = "/root/.claude/uploads/bebd2763-9587-528d-abc0-658fa0475796/"
FONTS = sys.argv[1]
OUT = sys.argv[2]
W, H, FPS = 1080, 1920, 30

ORANGE = (225, 90, 10)
WHITE = (255, 255, 255)
DARK = (30, 30, 28)
LOGO = sys.argv[3]

def font(name, size, var=None):
    f = ImageFont.truetype(f"{FONTS}/{name}", size)
    if var:
        f.set_variation_by_name(var)
    return f

ANTON = lambda s: font("Anton-Regular.ttf.ttf", s)
MONT = lambda s, v="Bold": font("Montserrat.ttf", s, v)

def load(name, scale=1.25):
    im = Image.open(UP + name).convert("RGB")
    im = im.resize((int(W * scale), int(W * scale * im.height / im.width)), Image.LANCZOS)
    return ImageEnhance.Contrast(im).enhance(1.04)

def kenburns(im, p, z0, z1, dx=0.0, dy=0.0):
    z = z0 + (z1 - z0) * p
    # crop window size in source pixels
    cw = im.width / z
    ch = cw * H / W
    if ch > im.height:
        ch = im.height; cw = ch * W / H
    cx = im.width / 2 + dx * (im.width - cw) / 2 * (2 * p - 1)
    cy = im.height / 2 + dy * (im.height - ch) / 2 * (2 * p - 1)
    box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    return im.resize((W, H), Image.BILINEAR, box=box)

def ease_out(t):
    t = max(0.0, min(1.0, t)); return 1 - (1 - t) ** 3

def ease_back(t):
    t = max(0.0, min(1.0, t)); c1 = 1.70158; c3 = c1 + 1
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2

def text_layer(lines, pad=(46, 26), bg=None, radius=28, gap=8, shadow=True):
    """lines: list of (text, font, color). Returns RGBA image, centered lines."""
    sizes = []
    for t, f, c in lines:
        b = f.getbbox(t)
        sizes.append((b[2] - b[0], b[3] - b[1], b))
    tw = max(s[0] for s in sizes) + pad[0] * 2
    th = sum(s[1] for s in sizes) + gap * (len(lines) - 1) + pad[1] * 2
    img = Image.new("RGBA", (tw + 40, th + 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if bg:
        d.rounded_rectangle((20, 20, 20 + tw, 20 + th), radius, fill=bg)
    y = 20 + pad[1]
    txt = Image.new("RGBA", img.size, (0, 0, 0, 0))
    td = ImageDraw.Draw(txt)
    for (t, f, c), (w, h, b) in zip(lines, sizes):
        x = 20 + (tw - w) / 2 - b[0]
        td.text((x, y - b[1]), t, font=f, fill=c)
        y += h + gap
    if shadow and not bg:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        sh.putalpha(txt.getchannel("A").filter(ImageFilter.GaussianBlur(10)).point(lambda a: int(a * 0.75)))
        img = Image.alpha_composite(img, sh)
    return Image.alpha_composite(img, txt)

def place(frame, layer, cx, cy, t, kind="up"):
    """animate layer in: t in [0..] seconds since appearance."""
    a = ease_out(t / 0.35)
    if a <= 0: return
    if kind == "up":
        off = (1 - ease_back(t / 0.5)) * 120
        l = layer
    else:  # pop
        sc = max(0.01, ease_back(t / 0.45))
        l = layer.resize((max(1, int(layer.width * sc)), max(1, int(layer.height * sc))), Image.BILINEAR)
        off = 0
    if a < 1:
        l = l.copy(); l.putalpha(l.getchannel("A").point(lambda v: int(v * a)))
    frame.alpha_composite(l, (int(cx - l.width / 2), int(cy - l.height / 2 + off)))

def vignette():
    g = Image.new("L", (W, H), 0); d = ImageDraw.Draw(g)
    d.rectangle((0, 0, W, 520), fill=150); d.rectangle((0, H - 700, W, H), fill=170)
    g = g.filter(ImageFilter.GaussianBlur(220))
    v = Image.new("RGBA", (W, H), DARK + (0,)); v.putalpha(g); return v
VIG = vignette()

# ---------- assets ----------
hook = load("064650fe-image.jpg")
montage = [load(n) for n in ["a446c196-image.jpg", "760934ab-image.jpg", "1011b296-image.jpg", "9e4b4d58-image.jpg",
                             "782c1b4d-image.jpg", "d18ec0ce-image.jpg", "66ee42b1-image.jpg", "5028e082-image.jpg",
                             "0aad2ef6-image.jpg", "e3207cc3-image.jpg", "41700cbb-image.jpg", "cc0f3daa-image.jpg"]]

L_hook1 = text_layer([("SEU PET MERECE", ANTON(118), WHITE)])
L_hook2 = text_layer([("FOTOS ASSIM", ANTON(150), ORANGE)])
L_hook3 = text_layer([("Vem fotografar com a gente!", MONT(50, "Bold"), WHITE)])

chips = [
    text_layer([("QUANDO", MONT(36, "ExtraBold"), ORANGE), ("12 DE OUTUBRO", ANTON(84), WHITE), ("DIA DAS CRIANÇAS", MONT(40, "ExtraBold"), ORANGE)],
               bg=(30, 30, 28, 220)),
    text_layer([("ONDE", MONT(36, "ExtraBold"), ORANGE), ("PARQUE DOS JEQUITIBÁS", ANTON(76), WHITE), ("SOBRADINHO", MONT(40, "ExtraBold"), ORANGE)],
               bg=(30, 30, 28, 220)),
    text_layer([("HORÁRIO", MONT(36, "ExtraBold"), ORANGE), ("A PARTIR DAS 7H", ANTON(84), WHITE)],
               bg=(30, 30, 28, 220)),
]
chip_for = [0] * 4 + [1] * 4 + [2] * 4

F_top = text_layer([("TE ESPERAMOS!", ANTON(124), DARK)], shadow=False)
F_card = text_layer([
    ("PARQUE DOS", ANTON(88), DARK),
    ("JEQUITIBÁS", ANTON(128), ORANGE),
    ("SOBRADINHO", MONT(50, "ExtraBold"), DARK),
], shadow=False, gap=14)
F_date = text_layer([("12 de outubro • Dia das Crianças", MONT(46, "Bold"), WHITE)], bg=ORANGE + (255,), pad=(40, 22))
F_time = text_layer([("A partir das 7h da manhã", MONT(52, "ExtraBold"), WHITE)], bg=DARK + (255,), pad=(40, 24))
F_cta = text_layer([("Traga seu pet e venha brilhar!", MONT(44, "SemiBold"), DARK)], shadow=False)

# ---------- logo ----------
L_AP = Image.open(f"{LOGO}/logo_aperture.png")
L_PAW = Image.open(f"{LOGO}/logo_paw.png")
L_TXT = Image.open(f"{LOGO}/logo_text.png")
L_FULL = Image.open(f"{LOGO}/logo_full.png")
AP_C, TXT_C, GRP_C = (356, 351), (627.5 - 115, 984 - 912), (627, 613)  # centers, source coords

def scaled(im, s):
    return im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)

def draw_logo(fr, cx, cy, s, t):
    """animated logo: aperture spins open, paw pops, wordmark wipes in. t = seconds since start."""
    ax, ay = cx + (626 - GRP_C[0]) * s, cy + (521 - GRP_C[1]) * s
    pa = ease_back(t / 0.7)
    if t > 0:
        ap = L_AP.rotate(-200 * (1 - ease_out(t / 0.8)), Image.BICUBIC)
        ap = scaled(ap, s * max(0.01, pa))
        a = ease_out(t / 0.3)
        if a < 1: ap.putalpha(ap.getchannel("A").point(lambda v: int(v * a)))
        fr.alpha_composite(ap, (int(ax - ap.width / 2), int(ay - ap.height / 2)))
    tp = t - 0.45
    if tp > 0:
        pw = scaled(L_PAW, s * max(0.01, ease_back(tp / 0.45)))
        fr.alpha_composite(pw, (int(ax - pw.width / 2), int(ay - pw.height / 2)))
    tt = t - 0.85
    if tt > 0:
        tx = scaled(L_TXT, s)
        wpx = int(tx.width * ease_out(tt / 0.5))
        if wpx > 0:
            tx = tx.crop((0, 0, wpx, tx.height))
            x0 = cx + (115 - GRP_C[0]) * s
            y0 = cy + (912 - GRP_C[1]) * s + (1 - ease_out(tt / 0.5)) * 30
            fr.alpha_composite(tx, (int(x0), int(y0)))

# watermark badge for the photo scenes
BADGE = Image.new("RGBA", (200, 190), (0, 0, 0, 0))
ImageDraw.Draw(BADGE).rounded_rectangle((0, 0, 199, 189), 26, fill=(255, 255, 255, 235))
_lf = scaled(L_FULL, 170 / L_FULL.width)
BADGE.alpha_composite(_lf, ((200 - _lf.width) // 2, (190 - _lf.height) // 2))

# ---------- timeline ----------
T_HOOK = 3.0
T_SHOT = 1.1
T_MONT = T_SHOT * len(montage)
T_FINAL = 7.0
TOTAL = T_HOOK + T_MONT + T_FINAL
N = int(TOTAL * FPS)

def flash(frame, k):
    if k <= 0: return frame
    return Image.blend(frame, Image.new("RGBA", (W, H), ORANGE + (255,)), k * 0.8)

ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                       "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                       "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                       "-shortest", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
                       "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart",
                       "-c:a", "aac", "-b:a", "128k", OUT], stdin=subprocess.PIPE)

prev_last = None
for i in range(N):
    t = i / FPS
    if t < T_HOOK:
        p = t / T_HOOK
        fr = kenburns(hook, p, 1.0, 1.18, dy=-0.3).convert("RGBA")
        fr.alpha_composite(VIG)
        place(fr, L_hook1, W / 2, 1210, t - 0.15)
        place(fr, L_hook2, W / 2, 1360, t - 0.45, "pop")
        place(fr, L_hook3, W / 2, 1510, t - 1.1)
    elif t < T_HOOK + T_MONT:
        tm = t - T_HOOK
        k = min(int(tm // T_SHOT), len(montage) - 1)
        ts = tm - k * T_SHOT
        p = ts / T_SHOT
        dirs = [(0.4, 0), (-0.4, 0), (0, -0.4), (0, 0.4)]
        dx, dy = dirs[k % 4]
        z0, z1 = (1.22, 1.05) if k % 2 else (1.05, 1.2)
        fr = kenburns(montage[k], p, z0, z1, dx, dy).convert("RGBA")
        fr.alpha_composite(VIG)
        c = chip_for[k]
        first = chip_for.index(c)
        since = tm - first * T_SHOT
        place(fr, chips[c], W / 2, 1430, since - 0.05)
        fr = flash(fr, max(0.0, 0.85 - ts / 0.12 * 0.85))
    if t < T_HOOK + T_MONT:
        place(fr, BADGE, 50 + 100, 150 + 95, t - 0.6)
    else:
        tf = t - T_HOOK - T_MONT
        fr = Image.new("RGBA", (W, H), WHITE + (255,))
        # aperture-style iris reveal from the last photo to the white brand screen
        if tf < 0.5:
            k = len(montage) - 1
            last = kenburns(montage[k], 1.0, *((1.22, 1.05) if k % 2 else (1.05, 1.2))).convert("RGBA")
            r = ease_out(tf / 0.5) * 1150
            m = Image.new("L", (W, H), 0)
            ImageDraw.Draw(m).ellipse((W / 2 - r, H / 2 - r, W / 2 + r, H / 2 + r), fill=255)
            last.paste(fr, (0, 0), m)
            fr = last
        # logo intro, then it moves up to make room for the info
        mv = ease_out((tf - 2.5) / 0.6)
        cy = 860 + (460 - 860) * mv
        sc = 0.62 + (0.44 - 0.62) * mv
        draw_logo(fr, W / 2, cy, sc, tf - 0.25)
        place(fr, F_top, W / 2, 850, tf - 3.0)
        place(fr, F_card, W / 2, 1120, tf - 3.25, "pop")
        place(fr, F_date, W / 2, 1395, tf - 3.7)
        place(fr, F_time, W / 2, 1520, tf - 3.95)
        place(fr, F_cta, W / 2, 1635, tf - 4.4)
    ff.stdin.write(fr.convert("RGB").tobytes())
    if i % 60 == 0:
        print(f"{i}/{N}", flush=True)

ff.stdin.close(); ff.wait()
print("done", OUT)
