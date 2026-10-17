import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Fredoka';
import { CONFIG } from '../config';
import { SafeZoneGuides } from '../components/ui';
import { CUT, ESTRELA, FINAL_FRAMES, HOOK_FRAMES, MONTAGEM_FRAMES, Shot } from './config';

const { fontFamily } = loadFont('normal', { weights: ['600', '700'], subsets: ['latin', 'latin-ext'] });
const ROUND = `${fontFamily}, "Noto Color Emoji", sans-serif`;
const Z = CONFIG.safeZone;

/** Uma imagem em tela cheia, enquadrada pelo rosto, com um leve zoom contínuo. */
const Full: React.FC<{ s: Shot; dur: number }> = ({ s, dur }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, dur], [1.06, 1]);
  const style: React.CSSProperties = {
    width: '100%', height: '100%', objectFit: 'cover',
    objectPosition: `${(s.x ?? 0.5) * 100}% ${(s.y ?? 0.4) * 100}%`, transform: `scale(${z})`,
    transformOrigin: `${(s.x ?? 0.5) * 100}% ${(s.y ?? 0.4) * 100}%`,
  };
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {s.clip ? <OffthreadVideo src={staticFile(s.clip)} muted startFrom={8} style={style} /> : <Img src={staticFile(s.photo!)} style={style} />}
    </AbsoluteFill>
  );
};

const Shots: React.FC<{ shots: Shot[] }> = ({ shots }) => (
  <>
    {shots.map((s, i) => (
      <Sequence key={i} from={i * CUT} durationInFrames={CUT}><Full s={s} dur={CUT} /></Sequence>
    ))}
  </>
);

const shadow = '0 4px 0 rgba(0,0,0,0.25), 0 6px 30px rgba(0,0,0,0.55)';

const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: f - 2, fps, config: { damping: 200 } });
  const b = spring({ frame: f - 24, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill>
      <Shots shots={ESTRELA.hook.shots} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.35) 75%, rgba(0,0,0,0.45) 100%)' }} />
      <div style={{ position: 'absolute', left: Z.side, right: Z.right, bottom: Z.bottom + 10, textAlign: 'center', fontFamily: ROUND, color: '#FFF8EC', textShadow: shadow, lineHeight: 1.02 }}>
        <div style={{ fontSize: 98, fontWeight: 700, opacity: a, transform: `translateY(${(1 - a) * 40}px)` }}>
          {ESTRELA.hook.linhas.map((l) => <div key={l}>{l}</div>)}
        </div>
        <div style={{ fontSize: 98, fontWeight: 700, color: CONFIG.colors.accentSoft, opacity: Math.min(1, b * 2), transform: `scale(${0.6 + 0.4 * b})`, marginTop: 6 }}>
          {ESTRELA.hook.final}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Final: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = (d: number, damp = 200) => spring({ frame: f - d, fps, config: { damping: damp } });
  const F = ESTRELA.final;
  const badge = p(14, 11);
  return (
    <AbsoluteFill>
      <Full s={{ clip: F.clip, x: 0.5, y: 0.5 }} dur={FINAL_FRAMES} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 32%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.35) 100%)' }} />
      <div style={{ position: 'absolute', top: Z.top, left: Z.side, right: Z.right, textAlign: 'center', fontFamily: ROUND, color: '#FFF8EC', textShadow: shadow }}>
        <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.02, opacity: p(0), transform: `translateY(${(1 - p(0)) * -40}px)` }}>{F.titulo}</div>
        <div style={{ fontSize: 56, fontWeight: 600, marginTop: 14, opacity: p(10) }}>{F.sub}</div>
        <div style={{ fontSize: 50, fontWeight: 600, marginTop: 8, opacity: p(18), color: CONFIG.colors.accentSoft }}>{F.info}</div>
      </div>
      {/* selo da marca (como o "S" da referência), abaixo do rosto */}
      <div style={{ position: 'absolute', left: Z.side, right: Z.right, bottom: Z.bottom + 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 44, padding: '16px 26px', transform: `scale(${badge}) rotate(${(1 - badge) * -20}deg)`, boxShadow: '0 16px 40px rgba(0,0,0,0.4)' }}>
          <Img src={staticFile('logo/logo_full.png')} style={{ height: 150, display: 'block' }} />
        </div>
        <div style={{ fontFamily: ROUND, fontSize: 56, fontWeight: 700, color: '#fff', background: '#25D366', borderRadius: 999, padding: '8px 30px', opacity: p(30), textShadow: 'none' }}>
          📲 {CONFIG.whatsapp}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export type EstrelaProps = { showSafeZones: boolean };

export const EstrelaReel: React.FC<EstrelaProps> = ({ showSafeZones }) => (
  <AbsoluteFill style={{ background: '#000' }}>
    <Sequence from={0} durationInFrames={HOOK_FRAMES}><Hook /></Sequence>
    <Sequence from={HOOK_FRAMES} durationInFrames={MONTAGEM_FRAMES}><Shots shots={ESTRELA.montagem} /></Sequence>
    <Sequence from={HOOK_FRAMES + MONTAGEM_FRAMES} durationInFrames={FINAL_FRAMES}><Final /></Sequence>
    {showSafeZones && <SafeZoneGuides />}
  </AbsoluteFill>
);
