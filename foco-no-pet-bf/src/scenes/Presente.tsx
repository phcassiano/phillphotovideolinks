import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { CONFIG } from '../config';
import { Backdrop, Reveal, SafeArea, useEnter } from '../components/ui';

const C = CONFIG.colors;

// 5. Vale-presente: cartão girando para a frente
export const Presente: React.FC = () => {
  const p = useEnter(6, 16);
  const f = CONFIG.photoFocus.presente;
  return (
    <AbsoluteFill>
      <Backdrop glowY={55} />
      <SafeArea style={{ justifyContent: 'center' }}>
        <Reveal delay={0}>
          <div style={{ fontSize: 86, fontWeight: 900, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 900 }}>{CONFIG.presente.title}</div>
        </Reveal>
        <div style={{ height: 70 }} />
        <div style={{ perspective: 1600 }}>
          <div
            style={{
              width: 880, height: 520, borderRadius: 44, overflow: 'hidden', display: 'flex',
              background: `linear-gradient(135deg, ${C.surface} 0%, #26262D 100%)`, border: `4px solid ${C.accent}`,
              boxShadow: `0 40px 90px rgba(0,0,0,0.6), 0 0 60px ${C.accent}33`,
              transform: `rotateY(${(1 - p) * 70 - 6}deg) rotateX(6deg) scale(${0.8 + 0.2 * p})`, opacity: Math.min(1, p * 2),
            }}
          >
            <Img src={staticFile(CONFIG.photos.presente)} style={{ width: 290, height: '100%', objectFit: 'cover', objectPosition: `${f.x * 100}% ${f.y * 100}%` }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', padding: '0 36px', textAlign: 'left', gap: 18 }}>
              <div style={{ fontSize: 56, fontWeight: 800, color: C.accent, lineHeight: 1.05, whiteSpace: 'nowrap' }}>{CONFIG.presente.cardLabel}</div>
              <div style={{ width: 120, height: 5, background: C.accent, borderRadius: 3 }} />
              <div style={{ fontSize: 60, fontWeight: 900, lineHeight: 1.05 }}>{CONFIG.oferta.title}</div>
            </div>
          </div>
        </div>
        <div style={{ height: 70 }} />
        <Reveal delay={14}>
          <div style={{ fontSize: 64, fontWeight: 800, color: C.accent }}>{CONFIG.presente.validade}</div>
        </Reveal>
      </SafeArea>
    </AbsoluteFill>
  );
};
