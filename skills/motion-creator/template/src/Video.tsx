import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "@fontsource/rubik/500.css";
import "@fontsource/rubik/700.css";
import "@fontsource/rubik/800.css";
import "@fontsource/rubik/900.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import { Backdrop, BackdropVariant } from "./components/Backdrop";
import { Mascot } from "./components/Mascot";
import { Caption, Finish, Flash, ProgressChip, WordCaptions } from "./components/Overlay";
import { getTheme, Theme } from "./theme";
import { MascotConfig, SceneBase, VideoSpec } from "./types";
import { clamp } from "./util";
import { SceneProps } from "./scenes/shared";
import { BoardScene, CountdownScene, CtaScene, HookScene, LockScene, RevealScene } from "./scenes/text";
import { ChartScene, ChecklistScene, CoinsScene, CompareScene, CounterScene, StepsScene } from "./scenes/data";
import {
  CalendarScene,
  CardsScene,
  ChatScene,
  HeadlineScene,
  MascotScene,
  PhotoScene,
  RouteScene,
  TagScene,
  VideoScene,
} from "./scenes/objects";

/** Catálogo de cenas: nome no video.json -> componente */
export const SCENES: Record<string, React.FC<SceneProps>> = {
  hook: HookScene,
  countdown: CountdownScene,
  board: BoardScene,
  lock: LockScene,
  reveal: RevealScene,
  cta: CtaScene,
  counter: CounterScene,
  chart: ChartScene,
  checklist: ChecklistScene,
  coins: CoinsScene,
  compare: CompareScene,
  steps: StepsScene,
  tag: TagScene,
  calendar: CalendarScene,
  chat: ChatScene,
  cards: CardsScene,
  photo: PhotoScene,
  video: VideoScene,
  route: RouteScene,
  mascot: MascotScene,
  headline: HeadlineScene,
};

/** cenas que já cuidam do próprio mascote */
const OWN_MASCOT = new Set(["cta", "route", "mascot"]);
/** cenas que cobrem a tela toda (sem cenário de fundo) */
const FULLSCREEN = (s: SceneBase) => s.type === "video" || (s.type === "photo" && s.props?.frame === "full");

const SceneShell: React.FC<{
  scene: SceneBase;
  theme: Theme;
  dur: number;
  index: number;
  mascot: MascotConfig;
  progressTotal: number;
  showCaption: boolean;
}> = ({ scene, theme, dur, index, mascot, progressTotal, showCaption }) => {
  const frame = useCurrentFrame();
  const t = frame / dur;
  const Comp = SCENES[scene.type];
  const p = scene.props ?? {};
  const showMascot = scene.mascot ?? !!mascot.enabled;

  // câmera: entra com zoom e sai empurrando
  const camera = p.camera ?? "push";
  const enter = interpolate(frame, [0, 10], [0, 1], { ...clamp, easing: (x) => 1 - (1 - x) ** 3 });
  const exit = interpolate(frame, [dur - 6, dur], [0, 1], clamp);
  const camScale =
    camera === "push" ? 1.0 + 0.06 * t : camera === "pull" ? 1.08 - 0.06 * t : camera === "rise" ? 1.04 : 1;
  const camY = camera === "rise" ? 80 - 160 * t : 0;
  const camRot = camera === "tilt" ? -2 + 4 * t : 0;
  const bgVariant: BackdropVariant | "none" = p.bg ?? (["checklist", "chat", "headline", "counter", "chart"].includes(scene.type) ? "dark" : "skyline");

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: theme.sky[0] }}>
      <AbsoluteFill
        style={{
          transform: `scale(${(camScale * (0.9 + 0.1 * enter)) * (1 + exit * 0.15)}) translateY(${camY}px) rotate(${camRot}deg)`,
          filter: `blur(${(1 - enter) * 14 + exit * 10}px)`,
          opacity: Math.min(1, enter * 1.4) * (1 - exit * 0.4),
        }}
      >
        {!FULLSCREEN(scene) && bgVariant !== "none" && <Backdrop theme={theme} variant={bgVariant} seed={index + 1} t={t} />}
        {Comp ? (
          <Comp p={p} theme={theme} dur={dur} mascot={mascot} showMascot={showMascot} />
        ) : (
          <div style={{ color: "red", fontSize: 60, padding: 80 }}>Cena desconhecida: {scene.type}</div>
        )}
        {showMascot && !OWN_MASCOT.has(scene.type) && (
          <div
            style={{
              position: "absolute",
              bottom: p.mascotY ?? 170,
              [mascot.side === "left" ? "left" : "right"]: 80,
            }}
          >
            <Mascot config={mascot} size={p.mascotSize ?? 170} pose={p.mascotPose ?? "idle"} delay={8} look={p.mascotLook} />
          </div>
        )}
      </AbsoluteFill>
      {scene.step ? <ProgressChip theme={theme} step={scene.step} total={progressTotal} /> : null}
      {showCaption && scene.caption && <Caption text={scene.caption} theme={theme} position={scene.captionPosition} />}
      {index > 0 && <Flash color={theme.primary} />}
      <Finish theme={theme} />
    </AbsoluteFill>
  );
};

export const MotionVideo: React.FC<{ spec: VideoSpec }> = ({ spec }) => {
  const { fps } = useVideoConfig();
  const mascot: MascotConfig = spec.mascot ?? { enabled: false };
  const total = spec.progress?.enabled ? spec.progress.total : 0;
  let cursor = 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {spec.scenes.map((s, i) => {
        const dur = Math.max(1, Math.round(s.duration * fps));
        const from = cursor;
        cursor += dur;
        return (
          <Sequence key={i} from={from} durationInFrames={dur} name={`${i + 1}. ${s.type}`}>
            <SceneShell
              scene={s}
              theme={getTheme(s.theme ?? spec.theme)}
              dur={dur}
              index={i}
              mascot={mascot}
              progressTotal={total}
              showCaption={!spec.words?.length}
            />
            {spec.sfx && i > 0 && <Audio src={staticFile("sfx/whoosh.wav")} volume={0.35} />}
          </Sequence>
        );
      })}
      {spec.words?.length ? <WordCaptions words={spec.words} theme={getTheme(spec.theme)} /> : null}
      {spec.music && <Audio src={staticFile(spec.music)} volume={spec.musicVolume ?? 0.5} loop />}
      {spec.voiceover && <Audio src={staticFile(spec.voiceover)} />}
    </AbsoluteFill>
  );
};

export const totalFrames = (spec: VideoSpec) =>
  spec.scenes.reduce((a, s) => a + Math.max(1, Math.round(s.duration * (spec.fps ?? 30))), 0);
