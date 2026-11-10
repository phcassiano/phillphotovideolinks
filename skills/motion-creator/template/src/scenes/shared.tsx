import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Theme } from "../theme";
import { MascotConfig } from "../types";
import { pop } from "../util";

export interface SceneProps {
  p: Record<string, any>;
  theme: Theme;
  /** duração da cena em frames */
  dur: number;
  mascot: MascotConfig;
  showMascot: boolean;
}

/** Placa de letreiro split-flap (estilo aeroporto). Cada letra "gira" até parar. */
export const SplitFlap: React.FC<{
  text: string;
  theme: Theme;
  size?: number;
  delay?: number;
  spacing?: number;
}> = ({ text, theme, size = 120, delay = 0, spacing = 0.12 }) => {
  const frame = useCurrentFrame();
  const chars = text.split("");
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return (
    <div style={{ display: "flex", gap: size * spacing, justifyContent: "center" }}>
      {chars.map((c, i) => {
        const settle = delay + 6 + i * 3;
        const spinning = frame < settle && c !== " ";
        const shown = spinning ? glyphs[(frame * 3 + i * 7) % glyphs.length] : c;
        const flip = spinning ? (frame % 2 === 0 ? 0.92 : 1) : 1;
        if (c === " ") return <div key={i} style={{ width: size * 0.35 }} />;
        return (
          <div
            key={i}
            style={{
              position: "relative",
              width: size * 0.72,
              height: size * 1.05,
              borderRadius: size * 0.08,
              background: "linear-gradient(180deg, #1d1d24 0%, #2a2a33 49%, #111116 51%, #1c1c22 100%)",
              boxShadow: `0 ${size * 0.06}px ${size * 0.15}px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.12)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f6f6f6",
              fontFamily: "'Rubik', monospace",
              fontWeight: 800,
              fontSize: size * 0.78,
              transform: `scaleY(${flip})`,
              opacity: frame < delay ? 0 : 1,
            }}
          >
            {shown}
            <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 3, background: "rgba(0,0,0,.65)" }} />
          </div>
        );
      })}
    </div>
  );
};

/** Moldura de letreiro com neon em volta */
export const NeonFrame: React.FC<{ theme: Theme; children: React.ReactNode; pad?: number; style?: React.CSSProperties }> = ({
  theme,
  children,
  pad = 26,
  style,
}) => (
  <div
    style={{
      padding: pad,
      borderRadius: 24,
      background: "rgba(10,6,20,.85)",
      border: `5px solid ${theme.primary}`,
      boxShadow: `0 0 ${40 * theme.glow + 4}px ${theme.primary}, inset 0 0 ${30 * theme.glow}px ${theme.primary}66`,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Cartão claro com sombra (estilo UI) */
export const Card: React.FC<{ theme: Theme; children: React.ReactNode; style?: React.CSSProperties; delay?: number; tilt?: number }> = ({
  theme,
  children,
  style,
  delay = 0,
  tilt = -4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = pop(frame, fps, delay, 13);
  const y = interpolate(s, [0, 1], [500, 0]);
  return (
    <div
      style={{
        background: theme.card,
        color: theme.ink,
        borderRadius: 40,
        padding: 48,
        boxShadow: `0 40px 80px rgba(0,0,0,.45), 0 0 0 6px rgba(255,255,255,.4), 0 0 ${60 * theme.glow}px ${theme.primary}55`,
        transform: `perspective(1600px) translateY(${y}px) rotateX(${(1 - s) * 30 + 6}deg) rotateZ(${tilt * (1 - s * 0.6)}deg)`,
        fontFamily: theme.fontBody,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Title: React.FC<{ theme: Theme; text: string; size?: number; delay?: number; color?: string; style?: React.CSSProperties }> = ({
  theme,
  text,
  size = 120,
  delay = 0,
  color,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = pop(frame, fps, delay, 9);
  return (
    <div
      style={{
        fontFamily: theme.fontDisplay,
        fontWeight: 900,
        fontSize: size,
        textTransform: "uppercase",
        textAlign: "center",
        lineHeight: 1,
        color: color ?? theme.text,
        transform: `scale(${0.4 + 0.6 * s}) translateY(${(1 - s) * 60}px)`,
        opacity: Math.min(1, s * 2),
        textShadow: `0 8px 0 rgba(0,0,0,.35), 0 0 ${30 * theme.glow}px ${theme.primary}aa`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};

export const center: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};
