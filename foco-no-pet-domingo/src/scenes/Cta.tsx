import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { CONFIG } from '../config';
import { Cover, Reveal, SafeArea } from '../components/ui';

const C = CONFIG.colors;

// 5. Chamada: capa vazia "seu pet aqui?" + comenta CAPA + WhatsApp
export const Cta: React.FC = () => {
  const f = useCurrentFrame();
  const pulse = 1 + 0.03 * Math.sin(f / 4);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(70% 40% at 50% 28%, ${C.accent}40 0%, ${C.background} 70%)` }}>
      <SafeArea style={{ justifyContent: 'space-between', paddingBottom: 20 }}>
        <Reveal from="pop">
          <div style={{ transform: 'rotate(-2deg)' }}>
            <Cover width={390} blank={CONFIG.cta.capaVazia} />
          </div>
        </Reveal>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <Reveal delay={16} from="pop">
            <div style={{ fontSize: 84, fontWeight: 900, letterSpacing: -2, whiteSpace: 'nowrap' }}>
              {CONFIG.cta.comenta}{' '}
              <span style={{ background: C.accent, padding: '0 22px', borderRadius: 16, display: 'inline-block', transform: `scale(${pulse})` }}>{CONFIG.palavraComentario}</span> 👇
            </div>
          </Reveal>
          <Reveal delay={24}>
            <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.15 }}>{CONFIG.cta.depois}</div>
          </Reveal>
          <Reveal delay={36}>
            <div style={{ marginTop: 14, background: '#fff', color: C.dark, borderRadius: 999, padding: '16px 46px', transform: `scale(${pulse})` }}>
              <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.1 }}>{CONFIG.cta.ou}</div>
              <div style={{ fontSize: 70, fontWeight: 900, lineHeight: 1.1, letterSpacing: -1 }}>{CONFIG.whatsapp}</div>
            </div>
          </Reveal>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};
