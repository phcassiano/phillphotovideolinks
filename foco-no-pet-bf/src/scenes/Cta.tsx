import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { CONFIG } from '../config';
import { KenBurns, Reveal, SafeArea } from '../components/ui';

const C = CONFIG.colors;

// 6. CTA: logo + chamada + WhatsApp. A base fica livre para o sticker de link.
export const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 1 + 0.025 * Math.sin(frame / 4);
  return (
    <AbsoluteFill style={{ background: C.background }}>
      <KenBurns src={CONFIG.photos.cta} focus={CONFIG.photoFocus.cta} from={1.1} to={1.2} style={{ filter: 'blur(26px) saturate(1.1)' }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.background}CC 0%, ${C.background}E6 55%, ${C.background} 100%)` }} />
      <SafeArea bottomExtra={CONFIG.ctaStickerSpace} style={{ justifyContent: 'center', gap: 56 }}>
        <Reveal from="scale">
          <div style={{ background: '#FFFFFF', borderRadius: 40, padding: '22px 40px' }}>
            <Img src={staticFile(CONFIG.logo)} style={{ height: 190, display: 'block' }} />
          </div>
        </Reveal>
        <Reveal delay={8}>
          <div style={{ fontSize: 118, fontWeight: 900, lineHeight: 1.02, letterSpacing: -3 }}>{CONFIG.cta.title}</div>
        </Reveal>
        <Reveal delay={18} from="scale">
          <div
            style={{
              background: C.accent, color: C.onAccent, borderRadius: 60, padding: '26px 60px', transform: `scale(${pulse})`,
              boxShadow: `0 20px 60px ${C.accent}55`,
            }}
          >
            <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1 }}>{CONFIG.cta.whatsappLabel}</div>
            <div style={{ fontSize: 80, fontWeight: 900, lineHeight: 1.1, letterSpacing: -1 }}>{CONFIG.cta.whatsapp}</div>
          </div>
        </Reveal>
      </SafeArea>
    </AbsoluteFill>
  );
};
