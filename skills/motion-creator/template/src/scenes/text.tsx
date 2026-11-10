import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Mascot } from "../components/Mascot";
import { Sparks } from "../components/Overlay";
import { clamp, ease, pop, rand } from "../util";
import { center, NeonFrame, SceneProps, SplitFlap, Title } from "./shared";

/** "hook": título gigante com kicker. props: { kicker?, title, sub? } */
export const HookScene: React.FC<SceneProps> = ({ p, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = pop(frame, fps, 0, 8);
  return (
    <div style={center}>
      {p.kicker && (
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontWeight: 800,
            fontSize: 46,
            letterSpacing: "0.3em",
            color: theme.accent,
            marginBottom: 20,
            opacity: s,
          }}
        >
          {p.kicker}
        </div>
      )}
      <Title theme={theme} text={p.title ?? ""} size={p.size ?? 150} delay={3} style={{ maxWidth: 960 }} />
      {p.sub && (
        <div
          style={{
            marginTop: 30,
            fontFamily: theme.fontBody,
            fontWeight: 600,
            fontSize: 44,
            color: theme.text,
            opacity: ease(frame, 12, 24),
          }}
        >
          {p.sub}
        </div>
      )}
    </div>
  );
};

/** "countdown": número gigante descendo. props: { from, to, label, sub } */
export const CountdownScene: React.FC<SceneProps> = ({ p, theme, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const from = p.from ?? 10;
  const to = p.to ?? 1;
  const n = Math.round(interpolate(frame, [4, dur * 0.6], [from, to], clamp));
  const tick = pop(frame % 8, fps, 0, 9);
  return (
    <div style={{ ...center, justifyContent: "flex-end", paddingBottom: 520 }}>
      <div
        style={{
          fontFamily: theme.fontDisplay,
          fontWeight: 900,
          fontSize: 340,
          lineHeight: 0.9,
          color: theme.text,
          transform: `scale(${0.9 + 0.1 * tick})`,
          textShadow: `0 14px 0 rgba(0,0,0,.4), 0 0 ${50 * theme.glow}px ${theme.primary}`,
        }}
      >
        {n}
      </div>
      <div style={{ fontFamily: theme.fontDisplay, fontWeight: 800, fontSize: 64, letterSpacing: "0.2em", color: theme.text }}>
        {p.label ?? "DIAS"}
      </div>
      {p.sub && (
        <div style={{ marginTop: 18, padding: "8px 22px", borderRadius: 12, background: "rgba(10,5,20,.75)", fontFamily: theme.fontBody, fontWeight: 600, fontSize: 38, color: theme.text }}>
          {p.sub}
        </div>
      )}
    </div>
  );
};

/** "board": letreiro split-flap. props: { text, sub?, y? } */
export const BoardScene: React.FC<SceneProps> = ({ p, theme }) => {
  const text: string = (p.text ?? "").toUpperCase();
  const size = text.length > 9 ? 95 : 130;
  return (
    <div style={{ ...center, justifyContent: "flex-start", paddingTop: p.y ?? 380 }}>
      <NeonFrame theme={theme}>
        <SplitFlap text={text} theme={theme} size={size} />
      </NeonFrame>
      {p.sub && <Title theme={theme} text={p.sub} size={70} delay={20} style={{ marginTop: 50 }} />}
    </div>
  );
};

/** "lock": algo trancado. props: { title, sub? } — cadeado cai e balança */
export const LockScene: React.FC<SceneProps> = ({ p, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drop = pop(frame, fps, 10, 7);
  const swing = Math.sin(frame / 5) * 14 * Math.max(0, 1 - (frame - 10) / 50);
  return (
    <div style={{ ...center, justifyContent: "flex-start", paddingTop: 300 }}>
      {/* porta de aço */}
      <div
        style={{
          width: 820,
          height: 680,
          borderRadius: 30,
          background: `repeating-linear-gradient(180deg, ${theme.sky[1]} 0 34px, ${theme.sky[0]} 34px 40px)`,
          boxShadow: `0 0 0 10px ${theme.primary}55, 0 40px 90px rgba(0,0,0,.6)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
        }}
      >
        <Title theme={theme} text={p.title ?? ""} size={p.size ?? 110} style={{ maxWidth: 740 }} />
      </div>
      <svg
        width={200}
        height={240}
        viewBox="0 0 100 120"
        style={{
          marginTop: -80,
          transform: `translateY(${(1 - drop) * -700}px) rotate(${swing}deg)`,
          transformOrigin: "50% 0%",
          filter: "drop-shadow(0 20px 20px rgba(0,0,0,.5))",
        }}
      >
        <path d="M28 55 V35 A22 22 0 0 1 72 35 V55" stroke="#c9c9d6" strokeWidth={10} fill="none" />
        <rect x={14} y={52} width={72} height={60} rx={10} fill="#e7b33c" />
        <rect x={14} y={52} width={72} height={14} rx={6} fill="#f6cf6a" />
        <circle cx={50} cy={80} r={8} fill="#5b4210" />
        <rect x={46} y={82} width={8} height={18} rx={3} fill="#5b4210" />
      </svg>
      {p.sub && <Title theme={theme} text={p.sub} size={70} delay={26} style={{ marginTop: 30 }} />}
    </div>
  );
};

/** "reveal": grande revelação com fogos e holofotes. props: { badge, title?, sub? } */
export const RevealScene: React.FC<SceneProps> = ({ p, theme, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lit = ease(frame, 12, 22);
  const s = pop(frame, fps, 4, 10);
  const bursts = [
    { x: 260, y: 520, d: 14 },
    { x: 820, y: 460, d: 20 },
    { x: 540, y: 340, d: 28 },
    { x: 180, y: 300, d: 40 },
    { x: 900, y: 640, d: 46 },
  ].filter((b) => b.d < dur);
  return (
    <div style={center}>
      {/* holofotes */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }}>
        {[-1, 1, -0.4, 0.4].map((k, i) => {
          const a = Math.sin(frame / 25 + i) * 18 + k * 25;
          return (
            <polygon
              key={i}
              points={`${540 + k * 300},1920 ${540 + k * 300 - 90},0 ${540 + k * 300 + 90},0`}
              fill="#fff"
              opacity={0.08 * lit}
              transform={`rotate(${a} ${540 + k * 300} 1920)`}
            />
          );
        })}
      </svg>
      {bursts.map((b, i) => (
        <Firework key={i} x={b.x} y={b.y} delay={b.d} color={[theme.primary, theme.accent, theme.secondary][i % 3]} />
      ))}
      <div
        style={{
          width: 280,
          height: 280,
          borderRadius: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: lit > 0.5 ? theme.primary : "#1b1b22",
          boxShadow: `0 0 ${120 * lit}px ${theme.primary}, inset 0 0 0 8px rgba(255,255,255,.15)`,
          fontFamily: theme.fontDisplay,
          fontWeight: 900,
          fontSize: 200,
          color: lit > 0.5 ? "#fff" : "#777",
          transform: `scale(${s})`,
          marginTop: -300,
        }}
      >
        {p.badge ?? "★"}
      </div>
      {p.title && <Title theme={theme} text={p.title} size={110} delay={14} style={{ marginTop: 80 }} />}
      {p.sub && <Title theme={theme} text={p.sub} size={60} delay={22} color={theme.accent} style={{ marginTop: 20 }} />}
    </div>
  );
};

const Firework: React.FC<{ x: number; y: number; delay: number; color: string }> = ({ x, y, delay, color }) => {
  const frame = useCurrentFrame() - delay;
  if (frame < 0) return null;
  const r = interpolate(frame, [0, 22], [0, 220], { ...clamp, easing: (t) => 1 - (1 - t) ** 3 });
  const o = interpolate(frame, [0, 6, 30], [0, 1, 0], clamp);
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: 28 }).map((_, i) => {
        const a = (i / 28) * Math.PI * 2;
        const rr = r * (0.8 + rand(i + delay) * 0.3);
        return (
          <line
            key={i}
            x1={x + Math.cos(a) * rr * 0.6}
            y1={y + Math.sin(a) * rr * 0.6 + frame * 0.6}
            x2={x + Math.cos(a) * rr}
            y2={y + Math.sin(a) * rr + frame * 1.2}
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            opacity={o}
          />
        );
      })}
    </svg>
  );
};

/** "cta": chamada final "COMENTA X". props: { verb?, word, mascot? } */
export const CtaScene: React.FC<SceneProps> = ({ p, theme, mascot, showMascot }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const word: string = p.word ?? "QUERO";
  const typed = Math.floor(interpolate(frame, [26, 26 + word.length * 4], [0, word.length], clamp));
  const sent = frame > 30 + word.length * 4;
  const heart = pop(frame, fps, 34 + word.length * 4, 7);
  return (
    <div style={center}>
      <Title theme={theme} text={p.verb ?? "Comenta"} size={80} delay={2} />
      <div
        style={{
          fontFamily: theme.fontDisplay,
          fontWeight: 900,
          fontSize: word.length > 8 ? 130 : 180,
          lineHeight: 1,
          background: `linear-gradient(180deg, ${theme.highlight[0]}, ${theme.highlight[1]})`,
          WebkitBackgroundClip: "text",
          color: "transparent",
          transform: `scale(${pop(frame, fps, 8, 8)})`,
          filter: `drop-shadow(0 10px 0 rgba(0,0,0,.35)) drop-shadow(0 0 ${30 * theme.glow}px ${theme.primary})`,
          textTransform: "uppercase",
        }}
      >
        {word}
      </div>
      {/* caixa de comentário */}
      <div
        style={{
          marginTop: 60,
          width: 820,
          height: 110,
          borderRadius: 60,
          background: "#f7f2fb",
          display: "flex",
          alignItems: "center",
          padding: "0 34px",
          gap: 22,
          boxShadow: "0 20px 50px rgba(0,0,0,.45)",
          transform: `translateY(${(1 - pop(frame, fps, 16, 12)) * 300}px)`,
          fontFamily: theme.fontDisplay,
          fontWeight: 800,
          fontSize: 46,
          color: "#222",
        }}
      >
        <div style={{ width: 52, height: 52, borderRadius: 99, background: theme.primary }} />
        <div style={{ flex: 1 }}>
          {word.slice(0, typed).toUpperCase()}
          {!sent && <span style={{ opacity: frame % 16 < 8 ? 1 : 0, color: theme.primary }}>|</span>}
        </div>
        <div style={{ fontSize: 60, color: sent ? "#ff3d7f" : "#ccc", transform: `scale(${sent ? 0.8 + 0.4 * heart : 1})` }}>♥</div>
      </div>
      {sent && <Sparks theme={theme} x={900} y={1180} delay={34 + word.length * 4} count={26} />}
      {showMascot && (
        <div style={{ position: "absolute", bottom: 160 }}>
          <Mascot config={mascot} size={220} pose="pula" delay={10} />
        </div>
      )}
    </div>
  );
};
