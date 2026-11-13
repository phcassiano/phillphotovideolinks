#!/usr/bin/env python3
"""Gera os dados reais do mapa usados por ../index.html.

Saídas em ../data/:
  sat_<col>_<row>.jpg  imagem de satélite Sentinel-2 cloudless 2016 (EOX, CC BY 4.0), Web Mercator z9
  elev.bin             grade de altitude (Int16, metros) - AWS Terrain Tiles (Terrarium)
  route.json           traçado da BR-040 (OSRM / OpenStreetMap) + distâncias por trecho
  borders.json         divisas estaduais simplificadas (click_that_hood / IBGE)
  meta.json            enquadramento comum a todos os arquivos

Uso: python3 build_data.py   (precisa de curl, Pillow e numpy)
"""
import io, json, math, os, subprocess, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'data')
CACHE = os.path.join(HERE, '.cache')
os.makedirs(OUT, exist_ok=True); os.makedirs(CACHE, exist_ok=True)

LON_MIN, LON_MAX, LAT_MAX, LAT_MIN = -50.6, -40.4, -13.6, -24.6
SAT_Z, ELEV_Z = 9, 8
CHUNK_COLS, CHUNK_ROWS = 2, 3
GRID_W = 384  # largura da grade de altitude (a altura segue a proporção)


def fetch(url, name):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        data = subprocess.run(['curl', '-sSfL', '--retry', '3', url], check=True, capture_output=True).stdout
        open(path, 'wb').write(data)
    return open(path, 'rb').read()


def tile_x(lon, z): return (lon + 180) / 360 * 2 ** z
def tile_y(lat, z):
    r = math.radians(lat)
    return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** z


# Enquadramento em tiles inteiros do zoom do satélite
tx0, tx1 = int(tile_x(LON_MIN, SAT_Z)), int(tile_x(LON_MAX, SAT_Z))
ty0, ty1 = int(tile_y(LAT_MAX, SAT_Z)), int(tile_y(LAT_MIN, SAT_Z))
nx, ny = tx1 - tx0 + 1, ty1 - ty0 + 1
print(f'satélite z{SAT_Z}: {nx}x{ny} tiles')

# ---------- Satélite ----------
sat = Image.new('RGB', (nx * 256, ny * 256))
for j in range(ny):
    for i in range(nx):
        x, y = tx0 + i, ty0 + j
        url = f'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{SAT_Z}/{y}/{x}.jpg'
        sat.paste(Image.open(io.BytesIO(fetch(url, f's2_{SAT_Z}_{x}_{y}.jpg'))).convert('RGB'), (i * 256, j * 256))
    sys.stdout.write(f'\r  linha {j + 1}/{ny}'); sys.stdout.flush()
print()
cw, ch = sat.width // CHUNK_COLS, sat.height // CHUNK_ROWS
for r in range(CHUNK_ROWS):
    for c in range(CHUNK_COLS):
        box = (c * cw, r * ch, sat.width if c == CHUNK_COLS - 1 else (c + 1) * cw, sat.height if r == CHUNK_ROWS - 1 else (r + 1) * ch)
        sat.crop(box).save(os.path.join(OUT, f'sat_{c}_{r}.jpg'), quality=80, optimize=True, progressive=True)

# ---------- Relevo ----------
s = 2 ** (SAT_Z - ELEV_Z)
ex0, ey0 = tx0 // s, ty0 // s
ex1, ey1 = (tx1 + 1 + s - 1) // s - 1, (ty1 + 1 + s - 1) // s - 1
ew, eh = ex1 - ex0 + 1, ey1 - ey0 + 1
elev = np.zeros((eh * 256, ew * 256), np.float32)
for j in range(eh):
    for i in range(ew):
        x, y = ex0 + i, ey0 + j
        im = np.asarray(Image.open(io.BytesIO(fetch(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{ELEV_Z}/{x}/{y}.png', f't_{ELEV_Z}_{x}_{y}.png'))).convert('RGB')).astype(np.float32)
        elev[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256] = im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768
# Recorta exatamente a área do satélite (em pixels do zoom do relevo)
px0 = (tx0 / s - ex0) * 256; py0 = (ty0 / s - ey0) * 256
pw = nx / s * 256; ph = ny / s * 256
crop = Image.fromarray(elev[int(py0):int(py0 + ph), int(px0):int(px0 + pw)])
GRID_H = round(GRID_W * ny / nx)
grid = np.asarray(crop.resize((GRID_W, GRID_H), Image.BILINEAR))
grid.astype('<i2').tofile(os.path.join(OUT, 'elev.bin'))
print('relevo', GRID_W, GRID_H, 'min/max', grid.min(), grid.max())

# ---------- Rota (OSRM / OpenStreetMap) ----------
pts = '-47.8828,-15.7939;-47.613,-16.768;-43.9345,-19.9167;-43.1729,-22.9068'
d = json.loads(fetch(f'https://router.project-osrm.org/route/v1/driving/{pts}?overview=full&geometries=geojson&continue_straight=true', 'osrm.json'))
route = d['routes'][0]
coords = route['geometry']['coordinates']
legs = [l['distance'] / 1000 for l in route['legs']]

def simplify(points, tol):
    """Douglas-Peucker (graus)."""
    if len(points) < 3: return points
    keep = [False] * len(points); keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]; bx, by = points[b]
        dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy) or 1e-12
        best, idx = 0, -1
        for k in range(a + 1, b):
            px, py = points[k]
            dist = abs(dy * px - dx * py + bx * ay - by * ax) / L
            if dist > best: best, idx = dist, k
        if best > tol:
            keep[idx] = True; stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(points, keep) if k]

rs = simplify(coords, 0.0012)
json.dump({
    'coords': [[round(x, 5), round(y, 5)] for x, y in rs],
    'km_bh': round(legs[0] + legs[1], 1), 'km_total': round(sum(legs), 1),
    'source': 'OSRM / © OpenStreetMap contributors'
}, open(os.path.join(OUT, 'route.json'), 'w'), separators=(',', ':'))
print('rota', len(coords), '->', len(rs), 'pontos;', round(legs[0] + legs[1], 1), 'km até BH;', round(sum(legs), 1), 'km total')

# ---------- Divisas estaduais ----------
gj = json.loads(fetch('https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson', 'br-states.geojson'))
lines = []
pad = 1.5
for f in gj['features']:
    g = f['geometry']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for poly in polys:
        for ring in poly:
            xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
            if max(xs) < LON_MIN - pad or min(xs) > LON_MAX + pad or max(ys) < LAT_MIN - pad or min(ys) > LAT_MAX + pad: continue
            pts_ = [tuple(p[:2]) for p in ring]; m = len(pts_) // 2
            sr = simplify(pts_[:m + 1], 0.01)[:-1] + simplify(pts_[m:], 0.01)  # anel fechado: simplifica em duas metades
            if len(sr) > 3: lines.append([[round(x, 3), round(y, 3)] for x, y in sr])
json.dump(lines, open(os.path.join(OUT, 'borders.json'), 'w'), separators=(',', ':'))
print('divisas', len(lines), 'linhas')

json.dump({
    'zoom': SAT_Z, 'tx0': tx0, 'ty0': ty0, 'nx': nx, 'ny': ny,
    'chunks': [CHUNK_COLS, CHUNK_ROWS], 'chunk_px': [cw, ch], 'sat_px': [sat.width, sat.height],
    'grid': [GRID_W, GRID_H],
    'credits': 'Satélite: Sentinel-2 cloudless 2016 by EOX (CC BY 4.0) · Relevo: AWS Terrain Tiles · Rota: © OpenStreetMap / OSRM · Divisas: IBGE'
}, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)
print('ok')
