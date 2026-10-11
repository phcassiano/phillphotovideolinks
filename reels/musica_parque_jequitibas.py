"""Original upbeat track synced to the reel: one beat = half a photo (1.1 s shot = 2 beats)."""
import sys, wave
import numpy as np

SR = 44100
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 23.2
BEAT = 0.55                       # 109.09 BPM
T_DROP = 3.0                      # montage starts: drop
T_END = 16.2                      # brand screen starts
GRID0 = T_DROP - 5 * BEAT         # beat grid origin (0.25 s), so cuts land on beats
N = int(DUR * SR)
rng = np.random.default_rng(7)
mixL = np.zeros(N); mixR = np.zeros(N)

def midi(n): return 440.0 * 2 ** ((n - 69) / 12)

def add(sig, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N or i + len(sig) <= 0: return
    s = sig[: N - i] * gain
    mixL[i:i + len(s)] += s * np.sqrt(0.5 * (1 - pan))
    mixR[i:i + len(s)] += s * np.sqrt(0.5 * (1 + pan))

def env(n, a=0.005, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)

def tone(freq, dur, harm=8, roll=1.0, detune=0.0):
    t = np.arange(int(dur * SR)) / SR
    out = np.zeros_like(t)
    for k in range(1, harm + 1):
        if freq * k > 16000: break
        ph = rng.uniform(0, 2 * np.pi)
        out += np.sin(2 * np.pi * freq * k * (1 + detune) * t + ph) / k ** roll
    return out

def bandnoise(dur, lo, hi):
    n = int(dur * SR); x = rng.standard_normal(n)
    F = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR)
    F[(f < lo) | (f > hi)] = 0
    y = np.fft.irfft(F, n); return y / (np.abs(y).max() + 1e-9)

# ---------- instruments ----------
def kick():
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 50 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.16) + 0.25 * bandnoise(0.35, 2000, 6000) * np.exp(-t / 0.004)

def clap():
    n = int(0.25 * SR); t = np.arange(n) / SR
    e = np.exp(-t / 0.07)
    for off in (0.0, 0.011, 0.022):  # flam
        e = np.maximum(e, np.where(t >= off, np.exp(-(t - off) / 0.01), 0))
    return bandnoise(0.25, 900, 5000) * e

def hat(open_=False):
    d = 0.18 if open_ else 0.045
    n = int((d * 3) * SR); t = np.arange(n) / SR
    return bandnoise(d * 3, 7000, 15000) * np.exp(-t / d)

def bass(note, dur):
    s = tone(midi(note), dur, harm=6, roll=1.3) + 0.6 * np.sin(2 * np.pi * midi(note - 12) * np.arange(int(dur * SR)) / SR)
    n = len(s); e = np.minimum(1, np.arange(n) / (0.004 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.02 * SR))
    return s * e

def pluck(note, dur=0.5, bright=1.0):
    s = tone(midi(note), dur, harm=10, roll=1.6 - 0.4 * bright) + 0.3 * tone(midi(note), dur, harm=4, detune=0.004)
    return s * env(len(s), 0.002, 0.16)

def stab(notes, dur=0.3):
    s = sum(tone(midi(n), dur, harm=7, roll=1.2, detune=d) for n in notes for d in (-0.006, 0.006))
    return s * env(len(s), 0.004, 0.11) / len(notes)

def pad(notes, dur):
    s = sum(tone(midi(n), dur, harm=5, roll=1.8, detune=d) for n in notes for d in (-0.004, 0.0, 0.004))
    n = len(s); a = np.minimum(1, np.arange(n) / (0.25 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.3 * SR))
    return s * a / len(notes)

def riser(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    out = np.zeros(n); seg = 2048
    for i in range(0, n, seg):  # sweep a band upward block by block
        p = i / n; c = 800 + 9000 * p ** 2
        blk = x[i:i + seg]; F = np.fft.rfft(blk); f = np.fft.rfftfreq(len(blk), 1 / SR)
        F *= np.exp(-((f - c) / (c * 0.5)) ** 2)
        out[i:i + seg] = np.fft.irfft(F, len(blk))
    return out / (np.abs(out).max() + 1e-9) * (t / dur) ** 2

def crash():
    d = 1.6; n = int(d * SR); t = np.arange(n) / SR
    return bandnoise(d, 4000, 16000) * np.exp(-t / 0.5)

# ---------- song (C major, I-V-vi-IV, 1 chord per bar) ----------
CHORDS = [(48, [60, 64, 67]), (43, [59, 62, 67]), (45, [60, 64, 69]), (41, [60, 65, 69])]
MELODY = [  # (beat offset in 2-bar phrase, midi, length in beats) — bouncy C-major pentatonic hook
    (0, 76, .5), (0.5, 79, .5), (1, 81, .5), (1.5, 79, .5), (2, 76, 1), (3, 74, .5), (3.5, 72, .5),
    (4, 74, .5), (4.5, 76, .5), (5, 79, 1), (6, 76, .5), (6.5, 74, .5), (7, 72, 1),
]
B = lambda k: GRID0 + k * BEAT
KICK, CLAP, HAT, OHAT = kick(), clap(), hat(), hat(True)
n_beats = int((DUR - GRID0) / BEAT) + 1
drop_b = 5
end_b = int(round((T_END - GRID0) / BEAT))
side = np.ones(N)

for b in range(n_beats):
    t = B(b); rb = b - drop_b; bar = rb // 4; chord_root, chord = CHORDS[bar % 4]
    pre = b < drop_b
    # drums
    if not pre:
        add(KICK, t, 0.95)
        i = int(t * SR); L = min(int(0.22 * SR), N - i)
        if L > 0: side[i:i + L] = np.minimum(side[i:i + L], 0.35 + 0.65 * np.linspace(0, 1, L) ** 0.6)
        add(OHAT if rb % 4 == 3 else HAT, t + BEAT / 2, 0.22, 0.3)
        add(HAT, t, 0.10, -0.3)
    if rb % 2 == 1:
        add(CLAP, t, 0.45 if not pre else 0.3, 0.05)
    # bass: off-beat bounce from the drop
    if not pre:
        add(bass(chord_root, BEAT * 0.42), t + BEAT / 2, 0.42)
        if rb % 4 == 0: add(bass(chord_root, BEAT * 0.3), t, 0.3)
    # chord stabs on the "and"s, pad in the intro and brand screen
    if rb % 4 == 0 and (pre or b >= end_b):
        add(pad(chord, 4 * BEAT), t, 0.22)
    if not pre:
        for off in ((0.5, 1.5) if rb % 2 == 0 else (0.75,)):
            add(stab(chord, 0.3), t + off * BEAT, 0.20, -0.2)
# melody: intro (soft, from beat 2) and full from the drop
for phrase_start in range(drop_b - 8, n_beats, 8):
    for off, note, ln in MELODY:
        k = phrase_start + off
        if k < 1 or B(k) >= DUR - 0.3: continue
        soft = phrase_start < drop_b
        add(pluck(note, ln * BEAT + 0.25, 0.6 if soft else 1.0), B(k), 0.16 if soft else 0.24, 0.25)
        if not soft: add(pluck(note + 12, ln * BEAT + 0.2, 0.5), B(k), 0.06, -0.4)
# FX
add(riser(T_DROP - 1.2), 1.2, 0.30)
add(crash(), T_DROP, 0.30); add(crash(), T_END, 0.28)
add(riser(1.6), T_END - 1.6, 0.18)

# sidechain pumping on the non-drum layers is approximated by ducking the whole bus lightly
mixL *= 0.75 + 0.25 * side; mixR *= 0.75 + 0.25 * side
# master: fade out last 1.2 s, soft clip, normalize
fade = np.ones(N); fl = int(1.2 * SR); fade[-fl:] = np.linspace(1, 0, fl) ** 1.5
st = np.stack([mixL, mixR], 1) * fade[:, None]
st = np.tanh(st * 1.4 / np.abs(st).max())
st /= np.abs(st).max() / 0.89
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype("<i2").tobytes())
print("ok", sys.argv[1])
