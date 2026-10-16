import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CONFIG } from '../config';
import { SANS, SERIF } from '../fonts';

const C = CONFIG.colors;
const Z = CONFIG.safeZone;

/** Área segura do Reels (topo, base com legenda e lateral direita com botões). */
export const SafeArea: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      position: 'absolute', top: Z.top, bottom: Z.bottom, left: Z.side, right: Z.right,
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      fontFamily: SANS, color: C.text, textWrap: 'balance', ...style,
    }}
  >
    {children}
  </div>
);

export const useEnter = (delay = 0, damping = 200) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.7 } });
};

export const Reveal: React.FC<{ delay?: number; from?: 'up' | 'right' | 'pop'; children: React.ReactNode; style?: React.CSSProperties }> = ({ delay = 0, from = 'up', children, style }) => {
  const p = useEnter(delay, from === 'pop' ? 12 : 200);
  const tr = from === 'up' ? `translateY(${(1 - p) * 80}px)` : from === 'right' ? `translateX(${(1 - p) * 300}px)` : `scale(${0.3 + 0.7 * p})`;
  return <div style={{ opacity: Math.min(1, p * 1.5), transform: tr, ...style }}>{children}</div>;
};

export const Photo: React.FC<{ src: string; focus: { x: number; y: number }; zoom?: number; style?: React.CSSProperties }> = ({ src, focus, zoom = 1, style }) => (
  <Img
    src={staticFile(src)}
    style={{
      width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${focus.x * 100}% ${focus.y * 100}%`,
      transform: `scale(${zoom})`, transformOrigin: `${focus.x * 100}% ${focus.y * 100}%`, ...style,
    }}
  />
);

/** Flash de câmera: branco que some em poucos frames. */
export const Flash: React.FC<{ at?: number; frames?: number; strength?: number }> = ({ at = 0, frames = 7, strength = 0.85 }) => {
  const f = useCurrentFrame() - at;
  const o = f < 0 ? 0 : interpolate(f, [0, frames], [strength, 0], { extrapolateRight: 'clamp' });
  return o > 0 ? <AbsoluteFill style={{ background: '#fff', opacity: o }} /> : null;
};

const Barcode: React.FC<{ s: number }> = ({ s }) => (
  <div style={{ background: '#fff', padding: `${8 * s}px ${10 * s}px`, display: 'flex', gap: 3 * s, alignItems: 'stretch', height: 70 * s }}>
    {Array.from({ length: 22 }, (_, i) => (
      <div key={i} style={{ width: ((i * 7) % 3 + 1) * 2.2 * s, background: '#111' }} />
    ))}
  </div>
);

/** Capa de revista "FOCO no Pet". Sem `photo` vira a capa vazia "seu pet aqui?". */
export const Cover: React.FC<{
  width: number; photo?: string; focus?: { x: number; y: number }; headline?: string; sub?: string; zoom?: number; blank?: string;
}> = ({ width, photo, focus = { x: 0.5, y: 0.4 }, headline, sub, zoom = 1, blank }) => {
  const s = width / 860;
  const height = width * 4 / 3;
  return (
    <div style={{ width, height, position: 'relative', overflow: 'hidden', borderRadius: 14 * s, background: C.dark, boxShadow: '0 40px 90px rgba(0,0,0,0.6)', fontFamily: SANS }}>
      {photo ? <Photo src={photo} focus={focus} zoom={zoom} /> : (
        <AbsoluteFill style={{ background: `radial-gradient(70% 55% at 50% 58%, #3a2416 0%, ${C.dark} 75%)`, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: SERIF, fontSize: 520 * s, color: C.accentSoft, lineHeight: 1, marginTop: 120 * s }}>?</div>
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.75) 100%)' }} />
      <div style={{ position: 'absolute', top: 26 * s, left: 34 * s, right: 34 * s, display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: 30 * s, fontWeight: 800, letterSpacing: 2 * s }}>
        <span>EDIÇÃO DE DOMINGO</span><span>{CONFIG.domingo}</span>
      </div>
      <div style={{ position: 'absolute', top: 40 * s, left: 0, right: 0, textAlign: 'center', fontFamily: SERIF, fontSize: 300 * s, lineHeight: 1, color: '#fff', letterSpacing: -6 * s, textShadow: '0 6px 30px rgba(0,0,0,0.35)' }}>
        {CONFIG.revista.masthead}
      </div>
      <div style={{ position: 'absolute', top: 318 * s, right: 70 * s, fontSize: 40 * s, fontWeight: 900, letterSpacing: 12 * s, color: C.accent, background: '#fff', padding: `${4 * s}px ${14 * s}px` }}>
        {CONFIG.revista.sub}
      </div>
      <div style={{ position: 'absolute', top: 430 * s, left: 34 * s, background: C.accent, color: '#fff', fontSize: 34 * s, fontWeight: 900, padding: `${8 * s}px ${18 * s}px`, transform: 'rotate(-4deg)' }}>
        EXCLUSIVO
      </div>
      {blank ? (
        <div style={{ position: 'absolute', left: 34 * s, right: 34 * s, bottom: 50 * s, color: '#fff', fontSize: 92 * s, fontWeight: 900, lineHeight: 1, textAlign: 'left' }}>{blank}</div>
      ) : (
        <div style={{ position: 'absolute', left: 34 * s, right: 200 * s, bottom: 46 * s, color: '#fff', textAlign: 'left' }}>
          <div style={{ fontSize: 128 * s, fontWeight: 900, lineHeight: 0.95, letterSpacing: -3 * s }}>{headline}</div>
          <div style={{ fontSize: 50 * s, fontWeight: 800, color: C.accentSoft, lineHeight: 1.1, marginTop: 10 * s }}>{sub}</div>
        </div>
      )}
      {!blank && <div style={{ position: 'absolute', right: 30 * s, bottom: 46 * s }}><Barcode s={s} /></div>}
    </div>
  );
};

export const SafeZoneGuides: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Z.top, background: 'rgba(255,0,60,0.35)', borderBottom: '4px dashed #ff003c' }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Z.bottom, background: 'rgba(255,0,60,0.35)', borderTop: '4px dashed #ff003c' }} />
    <div style={{ position: 'absolute', top: Z.top, bottom: Z.bottom, right: 0, width: Z.right, background: 'rgba(255,160,0,0.25)', borderLeft: '4px dashed #ffa000' }} />
  </AbsoluteFill>
);
