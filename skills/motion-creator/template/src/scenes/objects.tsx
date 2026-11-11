import React from "react";
import { Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Mascot } from "../components/Mascot";
import { clamp, ease, pop, rand } from "../util";
import { Card, center, SceneProps, Title } from "./shared";

const src = (s: string) => (/^https?:/.test(s) ? s : staticFile(s));

/** "tag": etiqueta pendurada balançando. props: { label, value } */
export const TagScene: React.FC<SceneProps> = ({ p, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drop = pop(frame, fps, 0, 9);
  const swing = Math.sin(frame / 9) * 10 * Math.exp(-frame / 50) + Math.sin(frame / 20) * 2;
  return (
    <div style={center}>
      <div
        style={{
          position: "absolute",
          top: 0,
          transform: `translateY(${(1 - drop) * -900}px) rotate(${swing - 8}deg)`,
          transformOrigin: "50% 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ width: 4, height: 620, background: "rgba(255,255,255,.8)" }} />
        <div
          style={{
            width: 560,
            height: 640,
            background: theme.card,
            color: theme.ink,
            clipPath: "polygon(25% 0, 75% 0, 100% 18%, 100% 100%, 0 100%, 0 18%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            fontFamily: theme.fontDisplay,
            boxShadow: "0 40px 80px rgba(0,0,0,.5)",
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", top: 60, width: 46, height: 46, borderRadius: 99, background: theme.sky[0] }} />
          <div style={{ marginTop: 80, fontSize: 48, fontWeight: 700, letterSpacing: "0.3em" }}>{p.label}</div>
          <div style={{ width: 70, height: 6, background: theme.primary, borderRadius: 3 }} />
          <div style={{ fontSize: String(p.value ?? "").length > 6 ? 110 : 170, fontWeight: 900 }}>{p.value}</div>
        </div>
      </div>
    </div>
  );
};

/** "calendar": folha de calendário que vira. props: { header?, pages: string[], footer? } — a página anterior é riscada com X */
export const CalendarScene: React.FC<SceneProps> = ({ p, theme, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pages: string[] = p.pages ?? ["MÊS 1", "MÊS 2"];
  const per = dur / pages.length;
  const idx = Math.min(pages.length - 1, Math.floor(frame / per));
  const local = frame - idx * per;
  const cross = ease(local, per * 0.35, per * 0.6);
  const flip = idx < pages.length - 1 ? ease(local, per * 0.8, per) : 0;
  const s = pop(frame, fps, 0, 12);
  const isLast = idx === pages.length - 1;
  const [big, ...rest] = pages[idx].split(" ");
  return (
    <div style={center}>
      <div style={{ transform: `scale(${s}) rotate(-3deg)`, perspective: 1600 }}>
        <div style={{ width: 700, height: 820, borderRadius: 26, background: "#fff", boxShadow: "0 40px 90px rgba(0,0,0,.5)", position: "relative", overflow: "hidden" }}>
          <div style={{ height: 110, background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: theme.fontDisplay, fontWeight: 800, letterSpacing: "0.2em", fontSize: 34 }}>
            {p.header ?? ""}
          </div>
          <div style={{ position: "absolute", top: -14, left: 0, right: 0, display: "flex", justifyContent: "space-around", padding: "0 40px" }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} style={{ width: 12, height: 40, borderRadius: 6, background: "#555" }} />
            ))}
          </div>
          <div
            style={{
              position: "absolute",
              inset: "110px 0 0 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: theme.fontDisplay,
              color: theme.ink,
              transformOrigin: "50% 0",
              transform: `rotateX(${flip * 100}deg)`,
              background: "#fff",
            }}
          >
            <div style={{ fontSize: 110, fontWeight: 900 }}>{big}</div>
            <div style={{ fontSize: 300, fontWeight: 900, lineHeight: 1, color: isLast ? theme.primary : theme.ink }}>{rest.join(" ")}</div>
            {p.footer && <div style={{ fontSize: 44, fontWeight: 800, opacity: 0.6, marginTop: 30 }}>{p.footer}</div>}
            {!isLast ? (
              <svg width={600} height={600} style={{ position: "absolute" }}>
                <line x1={80} y1={80} x2={80 + 440 * cross} y2={80 + 440 * cross} stroke="#ff3b5c" strokeWidth={26} strokeLinecap="round" />
                <line x1={520} y1={80} x2={520 - 440 * Math.max(0, cross * 2 - 1)} y2={80 + 440 * Math.max(0, cross * 2 - 1)} stroke="#ff3b5c" strokeWidth={26} strokeLinecap="round" />
              </svg>
            ) : (
              <svg width={560} height={560} style={{ position: "absolute", top: 120 }}>
                <circle cx={280} cy={300} r={210} fill="none" stroke={theme.primary} strokeWidth={14} strokeDasharray={`${1320 * ease(local, 6, 26)} 1320`} transform="rotate(-90 280 300)" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/** "chat": bolhas de conversa aparecendo. props: { messages: [{from:"eu"|"ia"|string, text}], title? } */
export const ChatScene: React.FC<SceneProps> = ({ p, theme, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const msgs: { from: string; text: string }[] = p.messages ?? [];
  const gap = Math.max(8, Math.floor((dur * 0.8) / Math.max(1, msgs.length)));
  return (
    <div style={{ ...center, gap: 28, padding: "0 70px" }}>
      {p.title && <Title theme={theme} text={p.title} size={90} style={{ marginBottom: 20 }} />}
      {msgs.map((m, i) => {
        const me = m.from === "eu" || m.from === "você" || m.from === "voce";
        const start = 6 + i * gap;
        const s = pop(frame, fps, start, 12);
        const typing = frame >= start - 10 && frame < start && !me;
        const chars = Math.floor(interpolate(frame, [start, start + m.text.length * 0.8], [0, m.text.length], clamp));
        if (frame < start - 10) return null;
        return (
          <div key={i} style={{ alignSelf: me ? "flex-end" : "flex-start", maxWidth: 780, transform: `scale(${typing ? 1 : s})`, transformOrigin: me ? "100% 100%" : "0 100%" }}>
            <div style={{ fontFamily: theme.fontDisplay, fontWeight: 800, fontSize: 26, letterSpacing: "0.15em", color: theme.text, opacity: 0.7, textAlign: me ? "right" : "left", marginBottom: 8, textTransform: "uppercase" }}>
              {me ? "você" : m.from === "ia" ? "claude" : m.from}
            </div>
            <div
              style={{
                padding: "26px 34px",
                borderRadius: 36,
                borderBottomRightRadius: me ? 8 : 36,
                borderBottomLeftRadius: me ? 36 : 8,
                background: me ? `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` : theme.card,
                color: me ? "#fff" : theme.ink,
                fontFamily: theme.fontBody,
                fontWeight: 600,
                fontSize: 44,
                lineHeight: 1.25,
                boxShadow: "0 18px 40px rgba(0,0,0,.35)",
              }}
            >
              {typing ? <span style={{ letterSpacing: 8 }}>{".".repeat(1 + (Math.floor(frame / 4) % 3))}</span> : me ? m.text : m.text.slice(0, chars)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** "cards": cartões/telas em leque. props: { count?, labels?: string[], images?: string[], title? } */
export const CardsScene: React.FC<SceneProps> = ({ p, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const imgs: string[] = p.images ?? [];
  const n = p.count ?? (imgs.length || 5);
  const labels: string[] = p.labels ?? [];
  return (
    <div style={center}>
      {p.title && <Title theme={theme} text={p.title} size={96} style={{ position: "absolute", top: 380 }} />}
      <div style={{ position: "relative", width: 1080, height: 800, marginTop: 160 }}>
        {Array.from({ length: n }).map((_, i) => {
          const s = pop(frame, fps, 6 + i * 4, 12);
          const mid = (n - 1) / 2;
          const off = i - mid;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 540 - 140,
                top: 60,
                width: 280,
                height: 500,
                borderRadius: 30,
                overflow: "hidden",
                border: "6px solid #fff",
                background: `linear-gradient(180deg, ${theme.sky[0]}, ${theme.primary} 70%, ${theme.accent})`,
                boxShadow: `0 30px 60px rgba(0,0,0,.5), 0 0 30px ${theme.primary}66`,
                transform: `translateX(${off * 190 * s}px) translateY(${Math.abs(off) * 40 * s}px) rotate(${off * 8 * s}deg) scale(${0.6 + 0.4 * s})`,
                opacity: Math.min(1, s * 2),
              }}
            >
              {imgs[i] ? (
                <Img src={src(imgs[i])} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <svg width={280} height={500}>
                  {Array.from({ length: 6 }).map((_, k) => (
                    <rect key={k} x={k * 50 - 10} y={500 - 120 - rand(i * 10 + k) * 200} width={44} height={400} fill={theme.sky[0]} opacity={0.85} />
                  ))}
                  <circle cx={140} cy={180} r={70} fill={theme.accent} opacity={0.85} />
                </svg>
              )}
              {labels[i] && (
                <div style={{ position: "absolute", bottom: 20, left: 14, right: 14, textAlign: "center", padding: "6px 0", borderRadius: 10, background: theme.accent, color: theme.ink, fontFamily: theme.fontDisplay, fontWeight: 900, fontSize: 24, textTransform: "uppercase" }}>
                  {labels[i]}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** "photo": foto em movimento (Ken Burns) com moldura. props: { src, frame?: "polaroid"|"full"|"neon", label?, zoom?: "in"|"out" } */
export const PhotoScene: React.FC<SceneProps> = ({ p, theme, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = frame / dur;
  const zoom = p.zoom === "out" ? 1.25 - 0.2 * k : 1.05 + 0.2 * k;
  const pan = (k - 0.5) * 60;
  const s = pop(frame, fps, 0, 13);
  const image = p.src ? (
    <Img src={src(p.src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom}) translateX(${pan}px)` }} />
  ) : (
    <div style={{ width: "100%", height: "100%", background: `linear-gradient(160deg, ${theme.primary}, ${theme.secondary})` }} />
  );
  if (p.frame === "full") return <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>{image}</div>;
  const polaroid = p.frame !== "neon";
  return (
    <div style={center}>
      <div
        style={{
          width: 820,
          padding: polaroid ? "30px 30px 130px" : 0,
          background: polaroid ? "#fbfaf6" : "transparent",
          borderRadius: polaroid ? 8 : 30,
          border: polaroid ? "none" : `8px solid ${theme.primary}`,
          boxShadow: polaroid ? "0 40px 90px rgba(0,0,0,.55)" : `0 0 70px ${theme.primary}`,
          transform: `translateY(${(1 - s) * 900}px) rotate(${(1 - s) * 25 - 3}deg)`,
          position: "relative",
        }}
      >
        <div style={{ width: "100%", height: 1000, overflow: "hidden", borderRadius: polaroid ? 2 : 22 }}>{image}</div>
        {polaroid && p.label && (
          <div style={{ position: "absolute", bottom: 32, left: 0, right: 0, textAlign: "center", fontFamily: "'Comic Sans MS', cursive", fontSize: 52, color: "#333" }}>
            {p.label}
          </div>
        )}
      </div>
    </div>
  );
};

/** "video": você na câmera / clipe. props: { src, startFrom?: segundos, muted?, frame?: "full"|"phone" } */
export const VideoScene: React.FC<SceneProps> = ({ p, theme }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const v = (
    <OffthreadVideo
      src={src(p.src)}
      startFrom={Math.round((p.startFrom ?? 0) * fps)}
      muted={p.muted ?? false}
      style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.02 + frame * 0.0006})` }}
    />
  );
  if (p.frame === "phone")
    return (
      <div style={center}>
        <div style={{ width: 720, height: 1280, borderRadius: 60, overflow: "hidden", border: "14px solid #111", boxShadow: `0 0 80px ${theme.primary}88` }}>{v}</div>
      </div>
    );
  return <div style={{ position: "absolute", inset: 0 }}>{v}</div>;
};

/** "route": mapa com rota sendo desenhada. props: { from, to, stops?: string[], label? } */
export const RouteScene: React.FC<SceneProps> = ({ p, theme, dur, mascot, showMascot }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const path = "M 200 1450 C 260 1150, 760 1260, 700 980 S 260 760, 420 560 S 900 520, 860 360";
  const total = 2200;
  const k = ease(frame, 8, dur * 0.8);
  const a = pop(frame, fps, 2, 10);
  const b = pop(frame, fps, Math.round(dur * 0.8), 8);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <path d={path} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth={30} strokeLinecap="round" transform="translate(6,10)" />
        <path d={path} fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={24} strokeLinecap="round" strokeDasharray="2 30" />
        <path d={path} fill="none" stroke={theme.primary} strokeWidth={22} strokeLinecap="round" strokeDasharray={`${total * k} ${total}`} style={{ filter: `drop-shadow(0 0 14px ${theme.primary})` }} />
        <g transform={`translate(200,1450) scale(${a})`}>
          <circle r={34} fill="#fff" />
          <circle r={18} fill={theme.secondary} />
        </g>
        <g transform={`translate(860,360) scale(${b})`}>
          <path d="M0 0 C -50 -60 -50 -120 0 -120 C 50 -120 50 -60 0 0 Z" fill={theme.primary} stroke="#fff" strokeWidth={6} />
          <circle cy={-80} r={18} fill="#fff" />
        </g>
      </svg>
      <Pin text={p.from ?? "Início"} x={200} y={1560} theme={theme} s={a} />
      <Pin text={p.to ?? "Destino"} x={860} y={200} theme={theme} s={b} />
      {(p.stops ?? []).map((st: string, i: number) => (
        <Pin key={i} text={st} x={[700, 420][i % 2]} y={[980, 560][i % 2] - 90} theme={theme} s={pop(frame, fps, Math.round(dur * (0.35 + i * 0.2)), 9)} small />
      ))}
      {showMascot && (
        <div style={{ position: "absolute", left: 120, top: 1240 }}>
          <Mascot config={mascot} size={160} pose="anda" />
        </div>
      )}
    </div>
  );
};

const Pin: React.FC<{ text: string; x: number; y: number; theme: any; s: number; small?: boolean }> = ({ text, x, y, theme, s, small }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: `translate(-50%,-50%) scale(${s})`,
      padding: small ? "8px 18px" : "14px 28px",
      borderRadius: 16,
      background: theme.card,
      color: theme.ink,
      fontFamily: theme.fontDisplay,
      fontWeight: 900,
      fontSize: small ? 30 : 44,
      whiteSpace: "nowrap",
      boxShadow: "0 14px 30px rgba(0,0,0,.4)",
    }}
  >
    {text}
  </div>
);

/** "mascot": o mascote como protagonista. props: { pose?, say?, size? } */
export const MascotScene: React.FC<SceneProps> = ({ p, theme, mascot }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ ...center, justifyContent: "flex-end", paddingBottom: 520 }}>
      {p.say && (
        <Card theme={theme} delay={10} tilt={3} style={{ padding: "30px 44px", borderRadius: 40, marginBottom: 40, maxWidth: 820 }}>
          <div style={{ fontFamily: theme.fontDisplay, fontWeight: 900, fontSize: 56, textAlign: "center" }}>{p.say}</div>
        </Card>
      )}
      <div style={{ transform: `scale(${pop(frame, fps, 0, 9)})` }}>
        <Mascot config={{ ...mascot, enabled: true }} size={p.size ?? 420} pose={p.pose ?? "acena"} />
      </div>
    </div>
  );
};

/** "headline": manchete / print de notícia. props: { source, title, date? } */
export const HeadlineScene: React.FC<SceneProps> = ({ p, theme }) => (
  <div style={center}>
    <Card theme={theme} style={{ width: 900, padding: 50 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: theme.fontDisplay, fontWeight: 800, fontSize: 30, color: theme.primary, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        <span>{p.source ?? "NOTÍCIA"}</span>
        <span style={{ opacity: 0.6, color: theme.ink }}>{p.date ?? ""}</span>
      </div>
      <div style={{ marginTop: 26, fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 64, lineHeight: 1.1 }}>{p.title}</div>
      <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 14 }}>
        {[90, 100, 70].map((w, i) => (
          <div key={i} style={{ width: `${w}%`, height: 18, borderRadius: 9, background: "rgba(0,0,0,.1)" }} />
        ))}
      </div>
    </Card>
  </div>
);
