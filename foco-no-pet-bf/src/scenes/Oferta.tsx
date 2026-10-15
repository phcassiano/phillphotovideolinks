import React from 'react';
import { AbsoluteFill } from 'remotion';
import { CONFIG } from '../config';
import { Backdrop, Check, KenBurns, Reveal, SafeArea } from '../components/ui';

const C = CONFIG.colors;

// 2. Oferta: foto + título + itens entrando um a um
export const Oferta: React.FC = () => (
  <AbsoluteFill>
    <Backdrop glowY={20} />
    <SafeArea>
      <Reveal from="scale" style={{ position: 'relative' }}>
        <div style={{ width: 920, height: 600, borderRadius: 40, overflow: 'hidden', border: `3px solid ${C.surfaceBorder}`, boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
          <KenBurns src={CONFIG.photos.oferta} focus={CONFIG.photoFocus.oferta} from={1.04} to={1.14} />
        </div>
        <div
          style={{
            position: 'absolute', left: 40, bottom: -40, background: C.accent, color: C.onAccent,
            fontSize: 56, fontWeight: 800, padding: '12px 36px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 2,
          }}
        >
          {CONFIG.oferta.eyebrow}
        </div>
      </Reveal>
      <div style={{ height: 90 }} />
      <Reveal delay={10}>
        <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1.05, letterSpacing: -2 }}>{CONFIG.oferta.title}</div>
      </Reveal>
      <div style={{ height: 50 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 34, alignSelf: 'stretch', paddingLeft: 40 }}>
        {CONFIG.oferta.items.map((item, i) => (
          <Reveal key={item} delay={30 + i * 16} from="right">
            <div style={{ display: 'flex', alignItems: 'center', gap: 32, fontSize: 66, fontWeight: 700, textAlign: 'left' }}>
              <Check size={76} />
              {item}
            </div>
          </Reveal>
        ))}
      </div>
    </SafeArea>
  </AbsoluteFill>
);
