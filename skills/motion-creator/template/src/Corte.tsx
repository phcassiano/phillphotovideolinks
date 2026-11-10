import React from "react";
import {
  AbsoluteFill,
  Audio,
  CalculateMetadataFunction,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Mascot } from "./components/Mascot";
import { Finish, Sparks } from "./components/Overlay";
import { CtaScene } from "./scenes/text";
import { NeonFrame, SplitFlap } from "./scenes/shared";
import { Backdrop } from "./components/Backdrop";
import { getTheme, Theme } from "./theme";
import { CaptionWord, MascotConfig, ThemeName } from "./types";
import { clamp, parseHighlight, pop, rand } from "./util";

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type CorteProps = {
  /** arquivo do corte em public/ (gerado por preparar-cortes.mjs) */
  src: string;
  duration: number;
  srcW: number;
  srcH: number;
  words: CaptionWord[];
  /** título-gancho fixo no topo. *destaque* */
  titulo: string;
  /** GRITO | REAÇÃO | AÇÃO | RISADA ... */
  tag?: string;
  emoji?: string;
  /** segundos (relativos ao corte) dos picos: zoom + flash + som */
  picos?: number[];
  /** blur = vídeo no meio com fundo desfocado; crop = tela cheia; split = jogo em cima + facecam embaixo */
  layout?: "blur" | "crop" | "split";
  /** área do jogo a mostrar (frações 0..1 do vídeo original). Padrão: tudo */
  jogo?: Rect;
  /** área da facecam (frações 0..1) — obrigatório no layout split */
  facecam?: Rect;
  /** abre com 1.5 s do pico ("olha o que vai acontecer") e volta pro começo */
  teaser?: boolean;
  cta?: { verb?: string; word: string } | null;
  handle?: string;
  theme?: ThemeName;
  music?: string | null;
  musicVolume?: number;
  mascot?: MascotConfig;
  parte?: { n: number; total: number } | null;
};

export const TEASER_S = 1.6;
const CTA_S = 2.6;

export const calcCorte: CalculateMetadataFunction<CorteProps> = ({ props }) => ({
  durationInFrames: Math.max(30, Math.round(((props.teaser ? TEASER_S : 0) + (props.duration || 1)) * 30)),
  fps: 30,
  width: 1080,
  height: 1920,
});

const src = (s: string) => (/^https?:/.test(s) ? s : staticFile(s));

/* ------------------------------------------------------------------ */
/* Recorte de vídeo: mostra a área `rect` do vídeo preenchendo a caixa */
/* ------------------------------------------------------------------ */

const CropVideo: React.FC<{
  file: string;
  srcW: number;
  srcH: number;
  rect?: Rect;
  boxW: number;
  boxH: number;
  startFrom?: number;
  muted?: boolean;
  zoom?: number;
  shake?: [number, number];
  style?: React.CSSProperties;
  filter?: string;
}> = ({ file, srcW, srcH, rect = { x: 0, y: 0, w: 1, h: 1 }, boxW, boxH, startFrom = 0, muted, zoom = 1, shake = [0, 0], style, filter }) => {
  const s = Math.max(boxW / (rect.w * srcW), boxH / (rect.h * srcH));
  const vw = srcW * s;
  const vh = srcH * s;
  const left = boxW / 2 - (rect.x + rect.w / 2) * vw;
  const top = boxH / 2 - (rect.y + rect.h / 2) * vh;
  return (
    <div style={{ position: "absolute", width: boxW, height: boxH, overflow: "hidden", ...style }}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${shake[0]}px, ${shake[1]}px) scale(${zoom})` }}>
        <OffthreadVideo
          src={src(file)}
          startFrom={startFrom}
          muted={muted}
          style={{ position: "absolute", left, top, width: vw, height: vh, maxWidth: "none", filter }}
        />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Legenda estilo "corte viral": 1-3 palavras, contorno grosso          */
/* ------------------------------------------------------------------ */

const ClipCaptions: React.FC<{ words: CaptionWord[]; theme: Theme; top: number; offset: number }> = ({ words, theme, top, offset }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps - offset;
  const groups: CaptionWord[][] = [];
  for (const w of words) {
    const g = groups[groups.length - 1];
    const chars = g ? g.reduce((a, x) => a + x.text.length, 0) : 0;
    if (!g || g.length >= 3 || chars + w.text.length > 16 || w.start - g[g.length - 1].end > 0.5 || /[.!?]$/.test(g[g.length - 1].text)) groups.push([w]);
    else g.push(w);
  }
  const gi = groups.findIndex((g, i) => t >= g[0].start - 0.03 && t < (groups[i + 1]?.[0].start ?? g[g.length - 1].end + 0.6) && t <= g[g.length - 1].end + 0.6);
  if (gi < 0) return null;
  const g = groups[gi];
  const startF = Math.round((g[0].start + offset) * fps);
  const s = pop(frame, fps, startF, 11);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 50,
        right: 50,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 40px",
        transform: `scale(${0.75 + 0.25 * s}) rotate(${(rand(gi) - 0.5) * 4}deg)`,
        fontFamily: theme.fontDisplay,
        fontWeight: 900,
        fontSize: 92,
        lineHeight: 1.05,
        textTransform: "uppercase",
      }}
    >
      {g.map((w, i) => {
        const active = t >= w.start && t < (g[i + 1]?.start ?? w.end + 0.3);
        return (
          <span
            key={i}
            style={{
              color: active ? theme.highlight[1] : "#fff",
              WebkitTextStroke: "12px #000",
              paintOrder: "stroke fill",
              textShadow: `0 8px 0 #000${active ? `, 0 0 40px ${theme.primary}` : ""}`,
              transform: `scale(${active ? 1.12 : 1})`,
              display: "inline-block",
            }}
          >
            {w.text.replace(/[,.;]$/, "")}
          </span>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Título-gancho fixo                                                  */
/* ------------------------------------------------------------------ */

const HookTitle: React.FC<{ text: string; tag?: string; emoji?: string; parte?: CorteProps["parte"]; theme: Theme; top: number }> = ({
  text,
  tag,
  emoji,
  parte,
  theme,
  top,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = pop(frame, fps, 0, 10);
  const tagS = pop(frame, fps, 6, 9);
  const parts = parseHighlight(text);
  const len = text.replace(/\*/g, "").length;
  return (
    <div style={{ position: "absolute", top, left: 60, right: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      {(tag || parte) && (
        <div style={{ display: "flex", gap: 14, transform: `scale(${tagS})` }}>
          {tag && (
            <div
              style={{
                padding: "8px 22px",
                borderRadius: 999,
                background: theme.primary,
                color: "#fff",
                fontFamily: theme.fontDisplay,
                fontWeight: 900,
                fontSize: 34,
                letterSpacing: "0.08em",
                boxShadow: `0 0 30px ${theme.primary}`,
              }}
            >
              {emoji ? `${emoji} ` : ""}
              {tag}
            </div>
          )}
          {parte && (
            <div style={{ padding: "8px 22px", borderRadius: 999, background: "rgba(0,0,0,.75)", border: "3px solid #fff", color: "#fff", fontFamily: theme.fontDisplay, fontWeight: 900, fontSize: 34 }}>
              PARTE {parte.n}/{parte.total}
            </div>
          )}
        </div>
      )}
      <div
        style={{
          padding: "22px 34px",
          borderRadius: 28,
          background: "#fff",
          color: "#111",
          fontFamily: theme.fontDisplay,
          fontWeight: 900,
          fontSize: len > 40 ? 52 : len > 26 ? 60 : 70,
          lineHeight: 1.1,
          textAlign: "center",
          textTransform: "uppercase",
          boxShadow: `0 16px 0 rgba(0,0,0,.35), 0 0 0 6px ${theme.primary}`,
          transform: `scale(${0.5 + 0.5 * s}) rotate(${-1.5 * s}deg)`,
          opacity: Math.min(1, s * 2),
        }}
      >
        {parts.map((p, i) => (
          <span key={i} style={p.hl ? { color: theme.primary } : undefined}>
            {p.text}
          </span>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Corpo do corte                                                      */
/* ------------------------------------------------------------------ */

const zoomAt = (t: number, picos: number[]) => {
  let z = 0;
  for (const p of picos) {
    const d = t - p + 0.12;
    if (d < 0 || d > 1.8) continue;
    z = Math.max(z, d < 0.15 ? d / 0.15 : d < 0.9 ? 1 : 1 - (d - 0.9) / 0.9);
  }
  return z;
};

const Body: React.FC<Omit<CorteProps, "theme"> & { theme: Theme; startFrom: number; offset: number; isTeaser?: boolean; captionsUntil?: number }> = (p) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = p.theme;
  const t = frame / fps + p.startFrom / fps; // tempo no corte
  const picos = p.picos ?? [];
  const z = zoomAt(t, picos);
  const zoom = 1 + 0.28 * z;
  const passed = picos.filter((x) => x <= t);
  const lastPeak = passed.length ? Math.max(...passed) : undefined;
  const since = lastPeak != null ? t - lastPeak : 99;
  const shakeAmt = since < 0.35 ? (1 - since / 0.35) * 14 : 0;
  const shake: [number, number] = [(rand(frame) - 0.5) * 2 * shakeAmt, (rand(frame + 99) - 0.5) * 2 * shakeAmt];
  const layout = p.layout ?? "blur";

  let main: React.ReactNode;
  if (layout === "split") {
    main = (
      <>
        <CropVideo file={p.src} srcW={p.srcW} srcH={p.srcH} rect={p.jogo} boxW={1080} boxH={1010} startFrom={p.startFrom} zoom={zoom} shake={shake} />
        <CropVideo
          file={p.src}
          srcW={p.srcW}
          srcH={p.srcH}
          rect={p.facecam ?? { x: 0.7, y: 0.65, w: 0.3, h: 0.35 }}
          boxW={1080}
          boxH={910}
          startFrom={p.startFrom}
          muted
          zoom={1 + 0.12 * z}
          style={{ top: 1010 }}
        />
        <div style={{ position: "absolute", top: 1002, left: 0, right: 0, height: 16, background: theme.primary, boxShadow: `0 0 30px ${theme.primary}` }} />
      </>
    );
  } else if (layout === "crop") {
    main = <CropVideo file={p.src} srcW={p.srcW} srcH={p.srcH} rect={p.jogo} boxW={1080} boxH={1920} startFrom={p.startFrom} zoom={zoom} shake={shake} />;
  } else {
    main = (
      <>
        <CropVideo file={p.src} srcW={p.srcW} srcH={p.srcH} rect={p.jogo} boxW={1080} boxH={1920} startFrom={p.startFrom} muted filter="blur(38px) brightness(.45) saturate(1.4)" style={{ transform: "scale(1.15)" }} />
        <AbsoluteFill style={{ background: `linear-gradient(180deg, ${theme.sky[0]}cc, transparent 30%, transparent 70%, ${theme.sky[0]}cc)` }} />
        <div style={{ position: "absolute", top: 560, left: 0, width: 1080, height: 800, boxShadow: `0 0 0 6px ${theme.primary}, 0 0 60px ${theme.primary}88` }}>
          <CropVideo file={p.src} srcW={p.srcW} srcH={p.srcH} rect={p.jogo} boxW={1080} boxH={800} startFrom={p.startFrom} zoom={zoom} shake={shake} />
        </div>
      </>
    );
  }

  const titleTop = layout === "split" ? 200 : 250;
  const capTop = layout === "split" ? 900 : layout === "crop" ? 1240 : 1420;
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], clamp);
  const peakFrame = lastPeak != null ? Math.round((lastPeak - p.startFrom / fps) * fps) : -1;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {main}
      {/* flash no pico */}
      {since < 0.3 && <AbsoluteFill style={{ background: "#fff", opacity: (1 - since / 0.3) * 0.45, mixBlendMode: "screen" }} />}
      {since < 1.2 && p.emoji && (
        <div
          style={{
            position: "absolute",
            top: layout === "split" ? 640 : 520,
            right: 70,
            fontSize: 150,
            transform: `scale(${pop(frame, fps, peakFrame, 7)}) rotate(${12 - since * 20}deg)`,
            filter: "drop-shadow(0 10px 20px rgba(0,0,0,.6))",
          }}
        >
          {p.emoji}
        </div>
      )}
      {since < 1.2 && peakFrame >= 0 && <Sparks theme={theme} x={540} y={layout === "split" ? 500 : 960} delay={peakFrame} count={30} />}
      {!p.isTeaser && <HookTitle text={p.titulo} tag={p.tag} emoji={p.emoji} parte={p.parte} theme={theme} top={titleTop} />}
      {(p.captionsUntil == null || frame < p.captionsUntil) && <ClipCaptions words={p.words} theme={theme} top={capTop} offset={-p.startFrom / fps} />}
      {p.handle && (
        <div style={{ position: "absolute", top: layout === "blur" ? 1300 : 1700, right: 40, fontFamily: theme.fontDisplay, fontWeight: 800, fontSize: 32, color: "#fff", opacity: 0.55, textShadow: "0 2px 6px #000" }}>
          {p.handle}
        </div>
      )}
      {!p.isTeaser && (
        <div style={{ position: "absolute", left: 0, top: layout === "blur" ? 1360 : layout === "split" ? 1002 : 1904, height: layout === "split" ? 16 : 10, width: `${progress * 100}%`, background: theme.highlight[1], boxShadow: `0 0 18px ${theme.highlight[1]}` }} />
      )}
      {/* som de impacto */}
      {picos.map((pk, i) => {
        const f = Math.round((pk - p.startFrom / fps) * fps) - 2;
        return f >= 0 && f < durationInFrames ? (
          <Sequence key={i} from={f} durationInFrames={30}>
            <Audio src={staticFile("sfx/boom.wav")} volume={0.6} />
          </Sequence>
        ) : null;
      })}
    </AbsoluteFill>
  );
};

/** Transição "rebobinando" do teaser para o começo */
const Rewind: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,.12) 0 3px, transparent 3px 9px)", transform: `translateY(${(frame * 23) % 9}px)` }} />
      <AbsoluteFill style={{ background: theme.primary, opacity: 0.25, mixBlendMode: "screen" }} />
      <div style={{ position: "absolute", top: 860, width: "100%", textAlign: "center", fontFamily: theme.fontDisplay, fontWeight: 900, fontSize: 130, color: "#fff", textShadow: "6px 0 #ff2a6d, -6px 0 #05d9e8" }}>
        ◀◀
      </div>
    </AbsoluteFill>
  );
};

export const Corte: React.FC<CorteProps> = (props) => {
  const { fps, durationInFrames } = useVideoConfig();
  const theme = getTheme(props.theme);
  const teaserF = props.teaser ? Math.round(TEASER_S * fps) : 0;
  const mainPeak = (props.picos ?? [])[0] ?? props.duration * 0.6;
  const teaserStart = Math.max(0, Math.round((mainPeak - 1.0) * fps));
  const ctaF = props.cta ? Math.round(CTA_S * fps) : 0;
  const mascot = props.mascot;

  if (!props.src) {
    return (
      <AbsoluteFill style={{ background: theme.sky[0], color: "#fff", fontSize: 50, alignItems: "center", justifyContent: "center", textAlign: "center", padding: 80 }}>
        Rode scripts/preparar-cortes.mjs e renderize com --props=cortes/corte-01.props.json
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {props.teaser && (
        <Sequence durationInFrames={teaserF} name="teaser">
          <Body {...props} theme={theme} startFrom={teaserStart} offset={0} isTeaser />
          <Sequence from={teaserF - 9}>
            <Rewind theme={theme} />
          </Sequence>
          <div style={{ position: "absolute", top: 260, width: "100%", textAlign: "center" }}>
            <span style={{ padding: "14px 30px", borderRadius: 20, background: "#000", color: "#fff", fontFamily: theme.fontDisplay, fontWeight: 900, fontSize: 56, border: `4px solid ${theme.primary}` }}>
              ESPERA ESSA 👀
            </span>
          </div>
        </Sequence>
      )}
      <Sequence from={teaserF} name="corte">
        <Body {...props} theme={theme} startFrom={0} offset={0} captionsUntil={props.cta ? durationInFrames - teaserF - ctaF : undefined} />
      </Sequence>
      {props.cta && (
        <Sequence from={durationInFrames - ctaF} name="cta">
          <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,.2), rgba(0,0,0,.85) 40%)" }} />
          <div style={{ position: "absolute", inset: 0, top: 380 }}>
            <CtaScene p={{ verb: props.cta.verb ?? "Comenta", word: props.cta.word }} theme={theme} dur={ctaF} mascot={mascot ?? { enabled: false }} showMascot={!!mascot?.enabled} />
          </div>
        </Sequence>
      )}
      {mascot?.enabled && !props.cta && (
        <div style={{ position: "absolute", bottom: 120, left: 40 }}>
          <Mascot config={mascot} size={130} />
        </div>
      )}
      <Sequence from={teaserF}>{props.music ? <Audio src={staticFile(props.music)} volume={props.musicVolume ?? 0.12} loop /> : null}</Sequence>
      <Finish theme={{ ...theme, grain: theme.grain * 0.4, scanlines: false }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Compilado "melhores momentos" 16:9 para YouTube                     */
/* ------------------------------------------------------------------ */

export type CompiladoProps = {
  titulo: string;
  theme?: ThemeName;
  handle?: string;
  itens: { src: string; duration: number; srcW: number; srcH: number; titulo: string; words: CaptionWord[] }[];
};

const INTRO_S = 1.8;

export const calcCompilado: CalculateMetadataFunction<CompiladoProps> = ({ props }) => ({
  durationInFrames: Math.max(30, Math.round((2.5 + (props.itens ?? []).reduce((a, i) => a + i.duration + INTRO_S, 0)) * 30)),
  fps: 30,
  width: 1920,
  height: 1080,
});

export const Compilado: React.FC<CompiladoProps> = ({ titulo, theme: tn, handle, itens = [] }) => {
  const { fps } = useVideoConfig();
  const theme = getTheme(tn);
  let cursor = Math.round(2.5 * fps);
  const n = itens.length;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence durationInFrames={cursor}>
        <Backdrop theme={theme} variant="skyline" t={0.2} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", top: 420 }}>
            <NeonFrame theme={theme}>
              <SplitFlap text={"TOP " + n} theme={theme} size={150} />
            </NeonFrame>
          </div>
          <div style={{ position: "absolute", top: 220, fontFamily: theme.fontDisplay, fontWeight: 900, fontSize: 90, color: "#fff", textTransform: "uppercase", textShadow: `0 0 30px ${theme.primary}` }}>
            {titulo}
          </div>
        </AbsoluteFill>
      </Sequence>
      {itens.map((it, i) => {
        const introF = Math.round(INTRO_S * fps);
        const clipF = Math.round(it.duration * fps);
        const from = cursor;
        cursor += introF + clipF;
        return (
          <React.Fragment key={i}>
            <Sequence from={from} durationInFrames={introF}>
              <Backdrop theme={theme} variant="dark" t={0.5} seed={i + 3} />
              <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40 }}>
                <div style={{ fontFamily: theme.fontDisplay, fontWeight: 900, fontSize: 260, color: theme.highlight[1], textShadow: `0 0 50px ${theme.primary}` }}>#{n - i}</div>
                <div style={{ fontFamily: theme.fontDisplay, fontWeight: 900, fontSize: 70, color: "#fff", textTransform: "uppercase", maxWidth: 1500, textAlign: "center" }}>
                  {it.titulo.replace(/\*/g, "")}
                </div>
              </AbsoluteFill>
            </Sequence>
            <Sequence from={from + introF} durationInFrames={clipF}>
              <CropVideo file={it.src} srcW={it.srcW} srcH={it.srcH} boxW={1920} boxH={1080} />
              <ClipCaptions words={it.words} theme={theme} top={820} offset={0} />
              <div style={{ position: "absolute", top: 40, left: 40, padding: "10px 26px", borderRadius: 16, background: theme.primary, color: "#fff", fontFamily: theme.fontDisplay, fontWeight: 900, fontSize: 44 }}>
                #{n - i}
              </div>
              {handle && <div style={{ position: "absolute", top: 50, right: 50, color: "#fff", opacity: 0.6, fontFamily: theme.fontDisplay, fontWeight: 800, fontSize: 36 }}>{handle}</div>}
            </Sequence>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
