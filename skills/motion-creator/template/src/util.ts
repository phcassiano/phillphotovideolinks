import { Easing, interpolate, spring } from "remotion";

/** gerador pseudo-aleatório determinístico (o render precisa ser igual em todo frame) */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const ease = (frame: number, from: number, to: number, a = 0, b = 1) =>
  interpolate(frame, [from, to], [a, b], {
    ...clamp,
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

export const pop = (frame: number, fps: number, delay = 0, damping = 12) =>
  spring({ frame: frame - delay, fps, config: { damping, stiffness: 160, mass: 0.7 } });

/** "Texto com *destaque*" -> partes */
export const parseHighlight = (s: string) => {
  const parts: { text: string; hl: boolean }[] = [];
  const re = /\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push({ text: s.slice(last, m.index), hl: false });
    parts.push({ text: m[1], hl: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ text: s.slice(last), hl: false });
  return parts;
};

export const formatNumber = (n: number, sep = ".") =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, sep);
