import React from 'react';
import { AbsoluteFill } from 'remotion';
import { CONFIG } from '../config';
import { Reveal, SafeArea, useEnter } from '../components/ui';

const C = CONFIG.colors;

// 4. A data: folha de calendário carimbando na tela
export const Data: React.FC = () => {
  const p = useEnter(6, 11);
  const D = CONFIG.data;
  return (
    <AbsoluteFill style={{ background: C.accent }}>
      <AbsoluteFill style={{ background: 'radial-gradient(80% 50% at 50% 45%, rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.25) 100%)' }} />
      <SafeArea style={{ justifyContent: 'center', gap: 40 }}>
        <Reveal>
          <div style={{ fontSize: 96, fontWeight: 900 }}>{D.kicker}</div>
        </Reveal>
        <div style={{ transform: `scale(${2.2 - 1.2 * p}) rotate(${(1 - p) * 10 - 3}deg)`, opacity: Math.min(1, p * 2), width: 720, borderRadius: 40, overflow: 'hidden', background: CONFIG.colors.paper, boxShadow: '0 40px 80px rgba(0,0,0,0.35)' }}>
          <div style={{ background: C.dark, color: '#fff', fontSize: 100, fontWeight: 900, letterSpacing: 8, padding: '18px 0' }}>{D.dia}</div>
          <div style={{ color: C.dark, fontSize: 280, fontWeight: 900, letterSpacing: -10, lineHeight: 1.1, padding: '10px 0 20px' }}>{CONFIG.domingo}</div>
        </div>
        <Reveal delay={16}>
          <div style={{ fontSize: 72, fontWeight: 900 }}>📍 {CONFIG.cidade}</div>
        </Reveal>
        <Reveal delay={24}>
          <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.15, color: '#fff' }}>{D.aviso}</div>
        </Reveal>
      </SafeArea>
    </AbsoluteFill>
  );
};
