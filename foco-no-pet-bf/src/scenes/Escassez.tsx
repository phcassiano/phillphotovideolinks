import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { CONFIG } from '../config';
import { Backdrop, Reveal, Rule, SafeArea, useEnter } from '../components/ui';

const C = CONFIG.colors;

// 4. Escassez: número grande de vagas + datas
export const Escassez: React.FC = () => {
  const frame = useCurrentFrame();
  const p = useEnter(6, 12);
  const count = Math.round(CONFIG.escassez.number * Math.min(1, useEnter(6, 200)));
  const pulse = 1 + 0.03 * Math.sin(frame / 5);
  const e = CONFIG.escassez;
  return (
    <AbsoluteFill>
      <Backdrop glowY={36} />
      <SafeArea style={{ justifyContent: 'center' }}>
        <Reveal>
          <div style={{ fontSize: 100, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 6, color: C.textMuted }}>{e.before}</div>
        </Reveal>
        <div
          style={{
            fontSize: 470, fontWeight: 900, lineHeight: 0.9, color: C.accent, letterSpacing: -16,
            transform: `scale(${(0.5 + 0.5 * p) * pulse})`, opacity: Math.min(1, p * 2), textShadow: `0 0 80px ${C.accent}55`,
          }}
        >
          {count}
        </div>
        <Reveal delay={12}>
          <div style={{ fontSize: 130, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 4, lineHeight: 1 }}>{e.after}</div>
        </Reveal>
        <div style={{ height: 60 }} />
        <Rule delay={22} />
        <div style={{ height: 50 }} />
        <Reveal delay={30}>
          <div style={{ fontSize: 66, fontWeight: 800 }}>{e.vendas}</div>
        </Reveal>
        <div style={{ height: 22 }} />
        <Reveal delay={40}>
          <div style={{ fontSize: 60, fontWeight: 700, color: C.textMuted, lineHeight: 1.2 }}>
            {e.sessoes}
            <br />
            <span style={{ color: C.accent }}>• {e.local}</span>
          </div>
        </Reveal>
      </SafeArea>
    </AbsoluteFill>
  );
};
