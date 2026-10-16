import React from 'react';
import { AbsoluteFill } from 'remotion';
import { CONFIG } from '../config';
import { Reveal, SafeArea } from '../components/ui';

const C = CONFIG.colors;

// 3. Como garantir: 3 passos
export const Passos: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(70% 40% at 50% 30%, ${C.accent}33 0%, ${C.background} 70%)` }}>
    <SafeArea style={{ justifyContent: 'center', gap: 56 }}>
      <Reveal>
        <div style={{ fontSize: 96, fontWeight: 900, letterSpacing: -2 }}>{CONFIG.passos.title}</div>
      </Reveal>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40, alignSelf: 'stretch' }}>
        {CONFIG.passos.items.map((item, i) => (
          <Reveal key={item} delay={10 + i * 15} from="right">
            <div style={{ display: 'flex', alignItems: 'center', gap: 34, textAlign: 'left', background: '#1C1A18', borderRadius: 36, padding: '30px 36px', border: `3px solid ${i === 2 ? C.accent : '#2C2926'}` }}>
              <div style={{ flexShrink: 0, width: 110, height: 110, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 70, fontWeight: 900 }}>{i + 1}</div>
              <div style={{ fontSize: 62, fontWeight: 800, lineHeight: 1.1 }}>{item}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </SafeArea>
  </AbsoluteFill>
);
