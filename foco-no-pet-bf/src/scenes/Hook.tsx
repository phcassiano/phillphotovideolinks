import React from 'react';
import { AbsoluteFill } from 'remotion';
import { CONFIG } from '../config';
import { KenBurns, Reveal, Rule, SafeArea } from '../components/ui';

const C = CONFIG.colors;

// 1. Gancho: foto em tela cheia com zoom lento + título
export const Hook: React.FC = () => (
  <AbsoluteFill style={{ background: C.background }}>
    <KenBurns src={CONFIG.photos.hook} focus={CONFIG.photoFocus.hook} from={1.02} to={1.16} />
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${C.background}99 0%, transparent 22%, transparent 40%, ${C.background}D9 66%, ${C.background} 100%)`,
      }}
    />
    <SafeArea style={{ justifyContent: 'flex-end', paddingBottom: 20 }}>
      <Reveal delay={4}>
        <div style={{ fontSize: 124, fontWeight: 900, lineHeight: 1, letterSpacing: -3, textTransform: 'uppercase', color: C.accent }}>{CONFIG.hook.title[0]}</div>
      </Reveal>
      <Reveal delay={10}>
        <div style={{ fontSize: 112, fontWeight: 900, lineHeight: 1.05, letterSpacing: -3, textTransform: 'uppercase' }}>{CONFIG.hook.title[1]}</div>
      </Reveal>
      <div style={{ height: 40 }} />
      <Rule delay={18} />
      <div style={{ height: 36 }} />
      <Reveal delay={26}>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.15 }}>{CONFIG.hook.subtitle[0]}</div>
      </Reveal>
      <Reveal delay={38}>
        <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1.15, color: C.accent }}>{CONFIG.hook.subtitle[1]}</div>
      </Reveal>
    </SafeArea>
  </AbsoluteFill>
);
