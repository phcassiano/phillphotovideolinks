import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Theme } from "../theme";
import { rand } from "../util";

/**
 * Cenário de fundo de cada tema. Tudo é desenhado em SVG/CSS (sem 3D real),
 * com camadas em paralaxe para dar sensação de câmera se movendo.
 *
 * variant:
 *  - "skyline": horizonte com sol e cidade (padrão)
 *  - "street":  rua em perspectiva com prédios dos lados
 *  - "dark":    só céu escuro + cidade desfocada (bom atrás de cartões)
 */
export type BackdropVariant = "skyline" | "street" | "dark";

interface Props {
  theme: Theme;
  variant?: BackdropVariant;
  seed?: number;
  /** progresso 0..1 da cena (usado pra mover a câmera) */
  t: number;
}

export const Backdrop: React.FC<Props> = ({ theme, variant = "skyline", seed = 1, t }) => {
  switch (theme.backdrop) {
    case "city":
      return <City theme={theme} variant={variant} seed={seed} t={t} />;
    case "paper":
      return <Paper theme={theme} seed={seed} t={t} />;
    case "board":
      return <Board theme={theme} seed={seed} t={t} />;
    case "blocks":
      return <Blocks theme={theme} seed={seed} t={t} />;
    case "velvet":
      return <Velvet theme={theme} seed={seed} t={t} />;
    case "map":
      return <MapBg theme={theme} seed={seed} t={t} />;
  }
};

/* ------------------------------------------------------------------ */
/* NEON CITY                                                           */
/* ------------------------------------------------------------------ */

const WINDOW_COLORS = ["#ffd38a", "#ff9ad5", "#9be7ff", "#ffe9b0", "#c9a7ff"];

interface Building {
  x: number;
  w: number;
  h: number;
  depth: number;
  windows: { x: number; y: number; on: boolean; c: string; blink: number }[];
  neon: boolean;
  antenna: boolean;
  roof: number;
}

const makeBuildings = (seed: number, count: number, baseW: number, maxH: number, width: number) => {
  const list: Building[] = [];
  let x = -60;
  let i = 0;
  while (x < width + 60 && i < count) {
    const r = (k: number) => rand(seed * 100 + i * 7 + k);
    const w = baseW * (0.6 + r(1) * 0.9);
    const h = maxH * (0.35 + r(2) * 0.65);
    const cols = Math.max(2, Math.floor(w / 26));
    const rows = Math.max(3, Math.floor(h / 34));
    const windows: Building["windows"] = [];
    for (let cx = 0; cx < cols; cx++) {
      for (let ry = 0; ry < rows; ry++) {
        const k = cx * 31 + ry * 17;
        windows.push({
          x: (cx + 0.5) / cols,
          y: (ry + 0.6) / (rows + 0.6),
          on: rand(seed * 13 + i * 101 + k) > 0.42,
          c: WINDOW_COLORS[Math.floor(rand(seed + i * 3 + k) * WINDOW_COLORS.length)],
          blink: rand(seed * 7 + k + i),
        });
      }
    }
    list.push({
      x,
      w,
      h,
      depth: 10 + r(3) * 26,
      windows,
      neon: r(4) > 0.55,
      antenna: r(5) > 0.7,
      roof: r(6),
    });
    x += w + 8 + r(7) * 26;
    i++;
  }
  return list;
};

const BuildingSvg: React.FC<{
  b: Building;
  ground: number;
  theme: Theme;
  frame: number;
  shade: number;
  showWindows: boolean;
}> = ({ b, ground, theme, frame, shade, showWindows }) => {
  const top = ground - b.h;
  const face = `rgba(${Math.round(30 + shade * 40)},${Math.round(14 + shade * 20)},${Math.round(
    55 + shade * 50,
  )},1)`;
  const side = `rgba(${Math.round(18 + shade * 25)},${Math.round(8 + shade * 12)},${Math.round(
    38 + shade * 30,
  )},1)`;
  const d = b.depth;
  return (
    <g>
      {/* lateral (dá o efeito 3D) */}
      <polygon
        points={`${b.x + b.w},${top} ${b.x + b.w + d},${top - d * 0.5} ${b.x + b.w + d},${ground - d * 0.5} ${b.x + b.w},${ground}`}
        fill={side}
      />
      {/* telhado */}
      <polygon
        points={`${b.x},${top} ${b.x + d},${top - d * 0.5} ${b.x + b.w + d},${top - d * 0.5} ${b.x + b.w},${top}`}
        fill={theme.secondary}
        opacity={0.55}
      />
      {/* fachada */}
      <rect x={b.x} y={top} width={b.w} height={b.h} fill={face} />
      {showWindows &&
        b.windows.map((w, k) => {
          const flick = w.blink > 0.97 ? (Math.sin(frame / 3 + k) > 0 ? 1 : 0.2) : 1;
          return w.on ? (
            <rect
              key={k}
              x={b.x + w.x * b.w - 7}
              y={top + w.y * b.h - 9}
              width={14}
              height={16}
              rx={2}
              fill={w.c}
              opacity={0.85 * flick}
            />
          ) : null;
        })}
      {b.neon && (
        <rect
          x={b.x + 2}
          y={top + 2}
          width={b.w - 4}
          height={b.h}
          fill="none"
          stroke={theme.primary}
          strokeWidth={3}
          filter="url(#glow)"
          opacity={0.9}
        />
      )}
      {b.antenna && (
        <>
          <line x1={b.x + b.w / 2} y1={top} x2={b.x + b.w / 2} y2={top - 60} stroke={face} strokeWidth={5} />
          <circle
            cx={b.x + b.w / 2}
            cy={top - 62}
            r={7}
            fill="#ff3b5c"
            opacity={Math.sin(frame / 6) > 0 ? 1 : 0.25}
            filter="url(#glow)"
          />
        </>
      )}
    </g>
  );
};

const City: React.FC<Props> = ({ theme, variant = "skyline", seed = 1, t }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const horizon = height * (variant === "street" ? 0.46 : 0.62);
  const far = useMemo(() => makeBuildings(seed + 3, 40, 110, 520, width + 400), [seed, width]);
  const mid = useMemo(() => makeBuildings(seed + 11, 30, 150, variant === "street" ? 900 : 640, width + 400), [seed, width, variant]);
  // no horizonte, abre um vão no meio pra mostrar o sol
  const gap = (b: Building) => {
    if (variant !== "skyline") return false;
    const c = b.x + b.w / 2 - 200;
    return Math.abs(c - width / 2) < 230;
  };
  const drift = t * 60;
  const dark = variant === "dark";

  return (
    <AbsoluteFill>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={theme.sky[0]} />
            <stop offset="0.55" stopColor={theme.sky[1]} />
            <stop offset="1" stopColor={dark ? theme.sky[1] : theme.sky[2]} />
          </linearGradient>
          <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe08a" />
            <stop offset="1" stopColor={theme.primary} />
          </linearGradient>
          <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={theme.sky[1]} />
            <stop offset="1" stopColor="#0c0518" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="soft">
            <feGaussianBlur stdDeviation={dark ? 10 : 2.5} />
          </filter>
          <clipPath id="sunclip">
            {Array.from({ length: 9 }).map((_, i) => (
              <rect key={i} x={0} y={i * 46 - 5} width={width} height={46 - i * 4.2} />
            ))}
          </clipPath>
        </defs>

        <rect width={width} height={height} fill="url(#sky)" />

        {/* estrelas */}
        {Array.from({ length: 70 }).map((_, i) => (
          <circle
            key={i}
            cx={rand(i + seed) * width}
            cy={rand(i * 3 + seed) * horizon * 0.6}
            r={1 + rand(i * 5) * 2}
            fill="#fff"
            opacity={0.25 + 0.5 * Math.abs(Math.sin(frame / 20 + i))}
          />
        ))}

        {/* sol listrado */}
        {!dark && (
          <g transform={`translate(${width / 2}, ${horizon - 170 + t * 30})`}>
            <circle r={300} fill={theme.primary} opacity={0.18} filter="url(#glow)" />
            <g clipPath="url(#sunclip)" transform="translate(-260,-260)">
              <circle cx={260} cy={260} r={260} fill="url(#sun)" />
            </g>
          </g>
        )}

        {/* cidade ao fundo (silhueta) */}
        <g transform={`translate(${-200 - drift * 0.4}, ${horizon})`} filter="url(#soft)" opacity={0.75}>
          {far.map((b, i) => (
            <rect key={i} x={b.x} y={-b.h * 0.8} width={b.w} height={b.h * 0.8} fill={theme.sky[0]} opacity={0.7} />
          ))}
        </g>

        {/* chão com grade em perspectiva */}
        <rect y={horizon} width={width} height={height - horizon} fill="url(#floor)" />
        <g opacity={0.55} stroke={theme.primary} strokeWidth={2}>
          {Array.from({ length: 22 }).map((_, i) => {
            const x = (i - 10.5) * 160;
            return <line key={i} x1={width / 2 + x * 0.12} y1={horizon} x2={width / 2 + x * 2.4} y2={height} />;
          })}
          {Array.from({ length: 14 }).map((_, i) => {
            const p = ((i + ((frame * 0.04) % 1)) / 14) ** 2.2;
            const y = horizon + p * (height - horizon);
            return <line key={`h${i}`} x1={0} y1={y} x2={width} y2={y} opacity={p} />;
          })}
        </g>

        {/* prédios principais */}
        <g transform={`translate(${-200 - drift}, 0)`}>
          {mid.map((b, i) => gap(b) ? null : (
            <BuildingSvg
              key={i}
              b={b}
              ground={horizon + 40}
              theme={theme}
              frame={frame}
              shade={rand(i + seed)}
              showWindows
            />
          ))}
        </g>

        {/* rua em perspectiva */}
        {variant === "street" && (
          <g>
            <polygon
              points={`${width / 2 - 40},${horizon + 40} ${width / 2 + 40},${horizon + 40} ${width},${height} 0,${height}`}
              fill="#140a22"
            />
            {Array.from({ length: 9 }).map((_, i) => {
              const p = ((i + ((frame * 0.06) % 1)) / 9) ** 2;
              const y = horizon + 40 + p * (height - horizon - 40);
              const h = 10 + p * 90;
              return (
                <rect key={i} x={width / 2 - 3 - p * 8} y={y} width={6 + p * 16} height={h} fill={theme.accent} opacity={0.9} />
              );
            })}
          </g>
        )}

        {/* névoa no horizonte */}
        <rect y={horizon - 80} width={width} height={200} fill={theme.primary} opacity={0.12} filter="url(#soft)" />
      </svg>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* OUTROS TEMAS                                                        */
/* ------------------------------------------------------------------ */

const Paper: React.FC<Omit<Props, "variant">> = ({ theme, seed = 1, t }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 80% at 50% 30%, ${theme.sky[2]} 0%, ${theme.sky[1]} 55%, ${theme.sky[0]} 100%)`,
      }}
    >
      <svg width={width} height={height}>
        {Array.from({ length: 14 }).map((_, i) => (
          <rect
            key={i}
            x={rand(i + seed) * width - 100}
            y={rand(i * 9 + seed) * height + t * 40 * (i % 2 ? 1 : -1)}
            width={200 + rand(i * 2) * 300}
            height={6 + rand(i * 4) * 10}
            fill={theme.accent}
            opacity={0.12}
            transform={`rotate(${rand(i) * 20 - 10})`}
          />
        ))}
        {/* furos de fita adesiva / bordas de papel */}
        <rect x={40} y={40} width={width - 80} height={height - 80} fill="none" stroke={theme.accent} strokeOpacity={0.25} strokeWidth={4} strokeDasharray="2 14" />
      </svg>
    </AbsoluteFill>
  );
};

const Board: React.FC<Omit<Props, "variant">> = ({ theme, seed = 1 }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(100% 70% at 50% 40%, ${theme.sky[2]}, ${theme.sky[0]})`,
        border: "36px solid #6b4a2b",
        boxShadow: "inset 0 0 120px rgba(0,0,0,.6)",
      }}
    >
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: 0.15 }}>
        {Array.from({ length: 30 }).map((_, i) => (
          <path
            key={i}
            d={`M ${rand(i + seed) * width} ${rand(i * 3) * height} q 80 ${rand(i * 7) * 60 - 30} 220 ${rand(i * 5) * 40 - 20}`}
            stroke="#fff"
            strokeWidth={10 + rand(i) * 20}
            fill="none"
            strokeLinecap="round"
            opacity={0.3}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

const Blocks: React.FC<Omit<Props, "variant">> = ({ theme, seed = 1, t }) => {
  const { width, height } = useVideoConfig();
  const colors = [theme.primary, theme.secondary, theme.accent];
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${theme.sky[0]}, ${theme.sky[1]} 50%, ${theme.sky[2]})` }}>
      <svg width={width} height={height}>
        {Array.from({ length: 10 }).map((_, i) => {
          const s = 80 + rand(i + seed) * 220;
          return (
            <rect
              key={i}
              x={rand(i * 3 + seed) * width - s / 2}
              y={rand(i * 5 + seed) * height - s / 2 + Math.sin(t * 3 + i) * 30}
              width={s}
              height={s}
              rx={s * 0.25}
              fill={colors[i % 3]}
              opacity={0.16}
              transform={`rotate(${rand(i) * 60 + t * 20 * (i % 2 ? 1 : -1)} ${rand(i * 3 + seed) * width} ${rand(i * 5 + seed) * height})`}
            />
          );
        })}
        {Array.from({ length: 40 }).map((_, i) => (
          <circle key={`d${i}`} cx={(i % 8) * 140 + 70} cy={Math.floor(i / 8) * 140 + 1300} r={5} fill={theme.ink} opacity={0.08} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

const Velvet: React.FC<Omit<Props, "variant">> = ({ theme, t }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(90% 60% at 50% 35%, ${theme.sky[2]}, ${theme.sky[0]} 75%)` }}>
      <svg width={width} height={height}>
        {Array.from({ length: 5 }).map((_, i) => (
          <polygon
            key={i}
            points={`${width / 2 + (i - 2) * 60},-50 ${width / 2 + (i - 2) * 380 - 120 + Math.sin(frame / 40 + i) * 60},${height} ${width / 2 + (i - 2) * 380 + 120 + Math.sin(frame / 40 + i) * 60},${height}`}
            fill={theme.primary}
            opacity={0.05 + t * 0.03}
          />
        ))}
        {Array.from({ length: 40 }).map((_, i) => (
          <circle
            key={`p${i}`}
            cx={rand(i) * width}
            cy={(rand(i * 3) * height - frame * (0.5 + rand(i) * 1.5)) % height + (rand(i * 3) * height - frame < 0 ? height : 0)}
            r={1.5 + rand(i * 7) * 3}
            fill={theme.accent}
            opacity={0.5}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

const MapBg: React.FC<Omit<Props, "variant">> = ({ theme, seed = 1, t }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: theme.sky[1], overflow: "hidden" }}>
      <svg width={width} height={height} style={{ transform: `scale(${1.1 + t * 0.08}) translateY(${-t * 30}px)` }}>
        {/* terra */}
        {Array.from({ length: 6 }).map((_, i) => (
          <path
            key={i}
            d={`M ${rand(i + seed) * width} ${rand(i * 2 + seed) * height}
               c 200 -80 380 40 420 200 s -120 300 -320 260 s -300 -200 -100 -460 z`}
            fill={theme.sky[2]}
            opacity={0.8}
          />
        ))}
        {/* ruas */}
        {Array.from({ length: 16 }).map((_, i) => (
          <line
            key={`r${i}`}
            x1={0}
            y1={rand(i * 4 + seed) * height}
            x2={width}
            y2={rand(i * 6 + seed) * height}
            stroke="#ffffff"
            strokeOpacity={0.08}
            strokeWidth={4 + rand(i) * 8}
          />
        ))}
        {/* grade */}
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={`g${i}`} x1={i * 100} y1={0} x2={i * 100} y2={height} stroke="#fff" strokeOpacity={0.05} />
        ))}
        {Array.from({ length: 20 }).map((_, i) => (
          <line key={`gh${i}`} x1={0} y1={i * 100} x2={width} y2={i * 100} stroke="#fff" strokeOpacity={0.05} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
