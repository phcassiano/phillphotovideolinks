import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CONFIG } from '../config';
import { FONT } from '../fonts';

const C = CONFIG.colors;

/** Área segura do Stories: o conteúdo das cenas fica dentro dela. */
export const SafeArea: React.FC<{ children: React.ReactNode; bottomExtra?: number; style?: React.CSSProperties }> = ({ children, bottomExtra = 0, style }) => (
  <AbsoluteFill
    style={{
      top: CONFIG.safeZone.top,
      bottom: CONFIG.safeZone.bottom + bottomExtra,
      left: 80,
      right: 80,
      height: 'auto',
      width: 'auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: FONT,
      color: C.text,
      textAlign: 'center',
      textWrap: 'balance',
      ...style,
    }}
  >
    {children}
  </AbsoluteFill>
);

/** Mola de entrada (0 → 1) que começa `delay` frames depois do início da cena. */
export const useEnter = (delay = 0, damping = 200) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.8 } });
};

/** Texto/elemento que sobe e aparece com spring. */
export const Reveal: React.FC<{ delay?: number; from?: 'up' | 'right' | 'scale'; children: React.ReactNode; style?: React.CSSProperties }> = ({
  delay = 0,
  from = 'up',
  children,
  style,
}) => {
  const p = useEnter(delay);
  const transform =
    from === 'up' ? `translateY(${(1 - p) * 70}px)` : from === 'right' ? `translateX(${(1 - p) * 260}px)` : `scale(${0.6 + 0.4 * p})`;
  return <div style={{ opacity: p, transform, ...style }}>{children}</div>;
};

/** Foto cobrindo a área, com zoom lento (Ken Burns). */
export const KenBurns: React.FC<{ src: string; focus: { x: number; y: number }; from?: number; to?: number; style?: React.CSSProperties }> = ({
  src,
  focus,
  from = 1,
  to = 1.12,
  style,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [from, to], { extrapolateRight: 'clamp' });
  return (
    <Img
      src={staticFile(src)}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: `${focus.x * 100}% ${focus.y * 100}%`,
        transform: `scale(${scale})`,
        transformOrigin: `${focus.x * 100}% ${focus.y * 100}%`,
        ...style,
      }}
    />
  );
};

/** Fundo escuro com um brilho sutil na cor de destaque e partículas douradas. */
export const Backdrop: React.FC<{ glowY?: number }> = ({ glowY = 30 }) => {
  const frame = useCurrentFrame();
  const dots = Array.from({ length: 26 }, (_, i) => {
    const r = (n: number) => { const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x); };
    const y = (r(1) * 2100 - frame * (0.6 + r(2) * 1.2)) % 2100;
    return { x: r(3) * 1080, y: y < 0 ? y + 2100 : y, s: 3 + r(4) * 5, o: 0.12 + r(5) * 0.3 };
  });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.background} 0%, ${C.surface} 100%)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 35% at 50% ${glowY}%, ${C.accent}33 0%, transparent 70%)` }} />
      {dots.map((d, i) => (
        <div key={i} style={{ position: 'absolute', left: d.x, top: d.y - 100, width: d.s, height: d.s, borderRadius: '50%', background: C.accent, opacity: d.o, filter: 'blur(1px)' }} />
      ))}
    </AbsoluteFill>
  );
};

/** Linha fina decorativa na cor de destaque que se estende. */
export const Rule: React.FC<{ delay?: number; width?: number }> = ({ delay = 0, width = 220 }) => {
  const p = useEnter(delay);
  return <div style={{ width: width * p, height: 6, borderRadius: 3, background: C.accent, margin: '0 auto' }} />;
};

/** Marcador "check" desenhado em SVG. */
export const Check: React.FC<{ size?: number }> = ({ size = 72 }) => (
  <svg width={size} height={size} viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
    <circle cx="36" cy="36" r="34" fill={C.accent} />
    <path d="M21 37 l10 10 l20 -22" stroke={C.onAccent} strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Guias de safe zone (só nos stills de conferência). */
export const SafeZoneGuides: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: CONFIG.safeZone.top, background: 'rgba(255,0,60,0.35)', borderBottom: '4px dashed #ff003c' }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: CONFIG.safeZone.bottom, background: 'rgba(255,0,60,0.35)', borderTop: '4px dashed #ff003c' }} />
  </AbsoluteFill>
);
