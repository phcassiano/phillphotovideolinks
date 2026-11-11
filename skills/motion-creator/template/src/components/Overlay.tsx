import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Theme } from "../theme";
import { parseHighlight, pop, rand } from "../util";
import { CaptionWord } from "../types";
import { useVideoConfig } from "remotion";

/** Granulado + vinheta + scanlines — dá o acabamento "cinema" */
export const Finish: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{ background: "radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,.55) 100%)" }}
      />
      {theme.grain > 0 && (
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: theme.grain * 0.35, mixBlendMode: "overlay" }}>
          <filter id={`grain${seed}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#grain${seed})`} />
        </svg>
      )}
      {theme.scanlines && (
        <AbsoluteFill
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,.18) 0 2px, transparent 2px 5px)",
            transform: `translateY(${(frame * 2) % 5}px)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

/** Clarão rápido na virada de cena */
export const Flash: React.FC<{ color?: string }> = ({ color = "#fff" }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 2, 9], [0.55, 0.35, 0], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: color, opacity: o, mixBlendMode: "screen" }} />;
};

/** Selo de progresso com estrelas: ★★☆☆ 2/4 */
export const ProgressChip: React.FC<{ theme: Theme; step: number; total: number }> = ({ theme, step, total }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = pop(frame, fps, 2, 11);
  return (
    <div
      style={{
        position: "absolute",
        top: 250,
        left: "50%",
        transform: `translateX(-50%) scale(${s})`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 30px",
        borderRadius: 999,
        background: "rgba(20,10,35,.82)",
        border: `4px solid ${theme.primary}`,
        boxShadow: `0 0 30px ${theme.primary}88`,
        color: "#fff",
        fontFamily: theme.fontDisplay,
        fontWeight: 800,
        fontSize: 40,
      }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const on = i < step;
        const just = i === step - 1;
        const sc = just ? pop(frame, fps, 8, 8) : 1;
        return (
          <span key={i} style={{ display: "inline-block", transform: `scale(${on ? sc : 1})`, color: on ? "#fff" : "transparent", WebkitTextStroke: on ? 0 : "2.5px #fff" }}>
            ★
          </span>
        );
      })}
      <span style={{ marginLeft: 8 }}>
        {step}/{total}
      </span>
    </div>
  );
};

const TextLine: React.FC<{ text: string; theme: Theme; size: number; delay: number; big?: boolean }> = ({
  text,
  theme,
  size,
  delay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const parts = parseHighlight(text);
  let wi = 0;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `0 ${size * 0.28}px` }}>
      {parts.flatMap((p, pi) =>
        p.text
          .split(/\s+/)
          .filter(Boolean)
          .map((w, k) => {
            const d = delay + wi++ * 3;
            const s = pop(frame, fps, d, 10);
            const y = interpolate(s, [0, 1], [40, 0]);
            return (
              <span
                key={`${pi}-${k}`}
                style={{
                  display: "inline-block",
                  opacity: Math.min(1, s * 1.5),
                  transform: `translateY(${y}px) scale(${0.7 + 0.3 * s})`,
                  fontSize: p.hl ? size * 1.35 : size,
                  lineHeight: 1.05,
                  ...(p.hl
                    ? {
                        background: `linear-gradient(180deg, ${theme.highlight[0]}, ${theme.highlight[1]})`,
                        WebkitBackgroundClip: "text",
                        color: "transparent",
                        filter: `drop-shadow(0 6px 0 rgba(0,0,0,.35)) drop-shadow(0 0 ${20 * theme.glow}px ${theme.primary}aa)`,
                      }
                    : {
                        color: theme.text,
                        textShadow: `0 6px 0 rgba(0,0,0,.35), 0 0 ${24 * theme.glow}px ${theme.primary}66`,
                      }),
                }}
              >
                {w}
              </span>
            );
          }),
      )}
    </div>
  );
};

/**
 * Legenda da cena. Quebre em linhas com " / ".
 * Ex.: "IMAGINA / *O GTA 6.*"
 */
export const Caption: React.FC<{ text: string; theme: Theme; position?: "top" | "middle" | "bottom"; delay?: number }> = ({
  text,
  theme,
  position = "bottom",
  delay = 4,
}) => {
  const lines = text.split(" / ");
  const size = lines.some((l) => l.length > 22) ? 64 : 84;
  const pos: React.CSSProperties =
    position === "top" ? { top: 360 } : position === "middle" ? { top: "42%" } : { bottom: 300 };
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        ...pos,
        fontFamily: theme.fontDisplay,
        fontWeight: 900,
        textTransform: "uppercase",
        textAlign: "center",
        letterSpacing: "0.01em",
      }}
    >
      {lines.map((l, i) => (
        <TextLine key={i} text={l} theme={theme} size={size} delay={delay + i * 8} />
      ))}
    </div>
  );
};

/** Legenda palavra-a-palavra sincronizada com a narração (modo áudio / câmera) */
export const WordCaptions: React.FC<{ words: CaptionWord[]; theme: Theme }> = ({ words, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // agrupa em blocos de até 4 palavras
  const groups: CaptionWord[][] = [];
  words.forEach((w, i) => {
    const g = groups[groups.length - 1];
    if (!g || g.length >= 4 || w.start - g[g.length - 1].end > 0.6) groups.push([w]);
    else g.push(w);
    void i;
  });
  const current = groups.find((g) => t >= g[0].start - 0.05 && t <= g[g.length - 1].end + 0.25);
  if (!current) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        bottom: 420,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 22px",
        fontFamily: theme.fontDisplay,
        fontWeight: 900,
        fontSize: 92,
        textTransform: "uppercase",
      }}
    >
      {current.map((w, i) => {
        const active = t >= w.start && t <= w.end + 0.05;
        const s = pop(frame, fps, Math.round(w.start * fps), 12);
        return (
          <span
            key={i}
            style={{
              transform: `scale(${active ? 1.08 : 0.94 + 0.06 * s})`,
              color: active ? theme.highlight[1] : theme.text,
              textShadow: `0 7px 0 rgba(0,0,0,.45), 0 0 ${26 * theme.glow}px ${theme.primary}88`,
              opacity: t >= w.start - 0.05 ? 1 : 0.35,
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

/** confete / faíscas */
export const Sparks: React.FC<{ theme: Theme; count?: number; x?: number; y?: number; delay?: number }> = ({
  theme,
  count = 40,
  x = 540,
  y = 700,
  delay = 0,
}) => {
  const frame = useCurrentFrame() - delay;
  if (frame < 0) return null;
  const colors = [theme.primary, theme.accent, theme.secondary, "#ffffff"];
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: count }).map((_, i) => {
        const a = rand(i) * Math.PI * 2;
        const v = 8 + rand(i * 3) * 18;
        const px = x + Math.cos(a) * v * frame;
        const py = y + Math.sin(a) * v * frame + 0.5 * 0.9 * frame * frame;
        const o = Math.max(0, 1 - frame / 40);
        return <circle key={i} cx={px} cy={py} r={4 + rand(i * 5) * 6} fill={colors[i % 4]} opacity={o} />;
      })}
    </svg>
  );
};
