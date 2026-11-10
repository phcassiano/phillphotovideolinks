import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Sparks } from "../components/Overlay";
import { clamp, ease, formatNumber, pop } from "../util";
import { Card, center, SceneProps, Title } from "./shared";

/** "counter": anel neon com número subindo em placas. props: { value, from?, label?, badge?, prefix?, suffix? } */
export const CounterScene: React.FC<SceneProps> = ({ p, theme, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const value = Number(p.value ?? 1000000);
  const from = Number(p.from ?? 0);
  const k = interpolate(frame, [8, dur * 0.65], [0, 1], { ...clamp, easing: (t) => 1 - (1 - t) ** 4 });
  const n = from + (value - from) * k;
  const str = `${p.prefix ?? ""}${formatNumber(n)}${p.suffix ?? ""}`;
  const finalLen = `${p.prefix ?? ""}${formatNumber(value)}${p.suffix ?? ""}`.length;
  const shown = str.padStart(finalLen, " ");
  const ring = pop(frame, fps, 0, 14);
  const done = k > 0.995;
  const cell = finalLen > 9 ? 78 : 100;
  return (
    <div style={center}>
      <svg width={980} height={980} viewBox="-490 -490 980 980" style={{ position: "absolute", transform: `scale(${ring}) rotate(${frame * 0.3}deg)` }}>
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={theme.accent} />
            <stop offset="1" stopColor={theme.primary} />
          </linearGradient>
          <filter id="rg">
            <feGaussianBlur stdDeviation={8} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {Array.from({ length: 72 }).map((_, i) => (
          <line
            key={i}
            x1={0}
            y1={-460}
            x2={0}
            y2={i % 6 === 0 ? -425 : -440}
            stroke="#fff"
            strokeWidth={4}
            opacity={0.6}
            transform={`rotate(${i * 5})`}
          />
        ))}
        <circle r={400} fill="none" stroke="url(#ring)" strokeWidth={22} filter="url(#rg)" strokeDasharray={`${2513 * k} 2513`} transform="rotate(-90)" />
        <circle r={370} fill="rgba(15,8,30,.55)" />
      </svg>
      {p.label && <Title theme={theme} text={p.label} size={44} delay={6} style={{ marginBottom: 24, letterSpacing: "0.05em" }} />}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: 14,
          borderRadius: 18,
          background: "#0d0d12",
          boxShadow: `0 0 0 4px ${theme.primary}88, 0 20px 50px rgba(0,0,0,.6)`,
          transform: `scale(${done ? 1 + 0.06 * Math.max(0, 1 - (frame - dur * 0.65) / 10) : 1})`,
        }}
      >
        {shown.split("").map((c, i) => {
          const sep = c === "." || c === ",";
          return (
            <div
              key={i}
              style={{
                width: sep ? cell * 0.3 : cell * 0.72,
                height: cell,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: sep ? "transparent" : "linear-gradient(180deg,#f7f7f7 0 49%,#dcdce2 51% 100%)",
                color: sep ? "#fff" : "#141418",
                fontFamily: "'Rubik', monospace",
                fontWeight: 900,
                fontSize: cell * 0.8,
                filter: !done && !sep ? `blur(${(1 - k) * 3}px)` : undefined,
              }}
            >
              {c}
            </div>
          );
        })}
      </div>
      {p.badge && (
        <div
          style={{
            marginTop: 26,
            padding: "10px 26px",
            borderRadius: 12,
            background: theme.primary,
            color: "#fff",
            fontFamily: theme.fontDisplay,
            fontWeight: 800,
            fontSize: 34,
            transform: `scale(${pop(frame, fps, Math.round(dur * 0.65), 9)})`,
          }}
        >
          {p.badge}
        </div>
      )}
      {done && <Sparks theme={theme} x={540} y={900} delay={Math.round(dur * 0.65)} />}
    </div>
  );
};

/** "chart": gráfico neon desenhando + marcador no pico. props: { points:number[], peakLabel?, from?, to?, title? } */
export const ChartScene: React.FC<SceneProps> = ({ p, theme, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pts: number[] = p.points ?? [10, 18, 14, 30, 26, 55, 40, 70, 62, 95, 80, 88];
  const W = 900;
  const H = 700;
  const max = Math.max(...pts);
  const coords = pts.map((v, i) => [(i / (pts.length - 1)) * W, H - (v / max) * H * 0.9]);
  const d = coords.map((c, i) => `${i ? "L" : "M"}${c[0]},${c[1]}`).join(" ");
  const k = interpolate(frame, [6, dur * 0.7], [0, 1], { ...clamp, easing: (t) => 1 - (1 - t) ** 2 });
  const peakI = pts.indexOf(max);
  const peak = coords[peakI];
  const showPeak = k >= peakI / (pts.length - 1);
  const ps = pop(frame, fps, Math.round(6 + (dur * 0.7 - 6) * (peakI / (pts.length - 1))), 8);
  return (
    <div style={center}>
      {p.title && <Title theme={theme} text={p.title} size={80} style={{ position: "absolute", top: 380 }} />}
      <svg width={W + 100} height={H + 140} viewBox={`-50 -60 ${W + 100} ${H + 140}`} style={{ marginTop: 120 }}>
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={theme.primary} stopOpacity={0.55} />
            <stop offset="1" stopColor={theme.primary} stopOpacity={0} />
          </linearGradient>
          <clipPath id="reveal">
            <rect x={-50} y={-60} width={(W + 50) * k + 50} height={H + 140} />
          </clipPath>
          <filter id="cg">
            <feGaussianBlur stdDeviation={7} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={i} x1={0} x2={W} y1={(i * H) / 5} y2={(i * H) / 5} stroke="#fff" strokeOpacity={0.12} strokeDasharray="8 10" />
        ))}
        <g clipPath="url(#reveal)">
          <path d={`${d} L${W},${H} L0,${H} Z`} fill="url(#area)" />
          <path d={d} fill="none" stroke={theme.primary} strokeWidth={10} strokeLinejoin="round" filter="url(#cg)" />
          <path d={d} fill="none" stroke="#fff" strokeWidth={3} strokeLinejoin="round" opacity={0.8} />
        </g>
        {showPeak && (
          <g transform={`translate(${peak[0]},${peak[1]}) scale(${ps})`}>
            <circle r={70} fill="none" stroke={theme.primary} strokeWidth={6} opacity={0.8} filter="url(#cg)" />
            <circle r={14} fill="#fff" />
            {p.peakLabel && (
              <g transform="translate(-150,-120)">
                <rect width={170} height={56} rx={10} fill={theme.primary} />
                <text x={85} y={39} textAnchor="middle" fontFamily="Rubik" fontWeight={800} fontSize={32} fill="#fff">
                  {p.peakLabel}
                </text>
              </g>
            )}
          </g>
        )}
        <text x={0} y={H + 60} fill="#fff" opacity={0.7} fontFamily="Rubik" fontWeight={700} fontSize={36}>
          {p.from ?? ""}
        </text>
        <text x={W} y={H + 60} fill="#fff" opacity={0.7} fontFamily="Rubik" fontWeight={700} fontSize={36} textAnchor="end">
          {p.to ?? ""}
        </text>
      </svg>
    </div>
  );
};

/** "checklist": cartão com itens marcados um a um. props: { title, subtitle?, items:[{tag?, time?, text}] } */
export const ChecklistScene: React.FC<SceneProps> = ({ p, theme, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items: { tag?: string; time?: string; text: string }[] = p.items ?? [];
  const gap = Math.max(5, Math.floor((dur * 0.75 - 12) / Math.max(1, items.length)));
  return (
    <div style={center}>
      <Card theme={theme} style={{ width: 920 }}>
        <div
          style={{
            display: "inline-block",
            fontFamily: theme.fontDisplay,
            fontWeight: 900,
            fontSize: 54,
            background: theme.accent,
            padding: "4px 16px",
            borderRadius: 10,
            transform: "rotate(-1.5deg)",
          }}
        >
          {p.title}
        </div>
        {p.subtitle && <div style={{ fontSize: 30, opacity: 0.6, margin: "14px 0 10px" }}>{p.subtitle}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
          {items.map((it, i) => {
            const d = 12 + i * gap;
            const s = pop(frame, fps, d, 13);
            const check = pop(frame, fps, d + Math.floor(gap * 0.6), 8);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  padding: "18px 22px",
                  borderRadius: 18,
                  background: "rgba(0,0,0,.05)",
                  opacity: s,
                  transform: `translateX(${(1 - s) * 200}px)`,
                }}
              >
                {it.time && (
                  <div style={{ background: theme.ink, color: "#fff", fontWeight: 800, fontSize: 30, padding: "8px 12px", borderRadius: 10, fontFamily: "Rubik" }}>
                    {it.time}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  {it.tag && (
                    <div style={{ color: i % 2 ? theme.secondary : theme.primary, fontFamily: theme.fontDisplay, fontWeight: 900, fontSize: 32 }}>{it.tag}</div>
                  )}
                  <div style={{ fontSize: 34, fontWeight: 600 }}>{it.text}</div>
                </div>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 99,
                    background: "#2fd47a",
                    color: "#fff",
                    fontSize: 42,
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `scale(${check})`,
                    boxShadow: "0 0 20px #2fd47a88",
                  }}
                >
                  ✓
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

/** "coins": pilhas de moedas subindo. props: { label?, stacks?: number[] } */
export const CoinsScene: React.FC<SceneProps> = ({ p, theme, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stacks: number[] = p.stacks ?? [9, 16, 24, 13];
  const k = ease(frame, 2, dur * 0.7);
  return (
    <div style={{ ...center, justifyContent: "flex-end", paddingBottom: 260 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
        {stacks.map((h, i) => {
          const n = Math.round(h * Math.min(1, k * (1.2 - i * 0.05)));
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column-reverse" }}>
              {Array.from({ length: n }).map((_, j) => (
                <div
                  key={j}
                  style={{
                    width: 180,
                    height: 36,
                    marginTop: -14,
                    borderRadius: "50%",
                    background: "linear-gradient(180deg,#ffe28a,#d99a1e 60%,#a8700f)",
                    boxShadow: "inset 0 -6px 0 #8a5a0b, 0 2px 0 #ffecb0",
                    transform: `translateX(${Math.sin(i * 3 + j) * 4}px)`,
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>
      {p.label && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            padding: "12px 34px",
            borderRadius: 14,
            background: theme.accent,
            color: theme.ink,
            fontFamily: theme.fontDisplay,
            fontWeight: 900,
            fontSize: 64,
            boxShadow: `0 0 50px ${theme.accent}`,
            transform: `scale(${pop(frame, fps, 14, 8)}) rotate(-3deg)`,
          }}
        >
          {p.label}
        </div>
      )}
      <Sparks theme={theme} x={540} y={1200} delay={Math.round(dur * 0.5)} count={30} />
    </div>
  );
};

/** "compare": antes x depois. props: { left:{title, value, sub?}, right:{title, value, sub?} } */
export const CompareScene: React.FC<SceneProps> = ({ p, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sides = [p.left ?? {}, p.right ?? {}];
  return (
    <div style={{ ...center, flexDirection: "row", gap: 30 }}>
      {sides.map((s: any, i) => {
        const pp = pop(frame, fps, i * 10, 11);
        const good = i === 1;
        return (
          <div
            key={i}
            style={{
              width: 450,
              height: 820,
              borderRadius: 36,
              padding: 36,
              background: good ? theme.card : "rgba(20,12,30,.75)",
              color: good ? theme.ink : "#bbb",
              border: good ? `6px solid ${theme.primary}` : "4px dashed #666",
              boxShadow: good ? `0 0 60px ${theme.primary}88` : "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 26,
              transform: `translateY(${(1 - pp) * 400}px) rotate(${good ? 2 : -2}deg) scale(${good ? 1.04 : 0.96})`,
              fontFamily: theme.fontDisplay,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 44, fontWeight: 900, textTransform: "uppercase", opacity: 0.8 }}>{s.title}</div>
            <div style={{ fontSize: 120, fontWeight: 900, color: good ? theme.primary : "#888", textDecoration: good ? "none" : "line-through" }}>
              {s.value}
            </div>
            {s.sub && <div style={{ fontSize: 32, fontWeight: 600, fontFamily: theme.fontBody }}>{s.sub}</div>}
            <div style={{ fontSize: 90 }}>{good ? "✅" : "❌"}</div>
          </div>
        );
      })}
    </div>
  );
};

/** "steps": lista numerada que vai acendendo. props: { title?, items: string[] } */
export const StepsScene: React.FC<SceneProps> = ({ p, theme, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items: string[] = p.items ?? [];
  const gap = Math.max(6, Math.floor((dur * 0.8 - 10) / Math.max(1, items.length)));
  return (
    <div style={{ ...center, gap: 26, padding: "0 80px" }}>
      {p.title && <Title theme={theme} text={p.title} size={84} style={{ marginBottom: 30 }} />}
      {items.map((it, i) => {
        const s = pop(frame, fps, 10 + i * gap, 12);
        const active = frame >= 10 + i * gap && frame < 10 + (i + 1) * gap;
        return (
          <div
            key={i}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 28,
              padding: "24px 30px",
              borderRadius: 26,
              background: active ? theme.primary : "rgba(15,8,30,.7)",
              border: `3px solid ${theme.primary}`,
              boxShadow: active ? `0 0 50px ${theme.primary}` : "none",
              transform: `translateX(${(1 - s) * (i % 2 ? 800 : -800)}px) scale(${active ? 1.04 : 1})`,
              color: active ? theme.ink : "#fff",
              fontFamily: theme.fontDisplay,
            }}
          >
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: 99,
                background: active ? "#fff" : theme.primary,
                color: active ? theme.primary : "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 48,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <div style={{ fontWeight: 800, fontSize: 48 }}>{it}</div>
          </div>
        );
      })}
    </div>
  );
};
