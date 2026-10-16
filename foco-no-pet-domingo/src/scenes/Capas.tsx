import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CONFIG } from '../config';
import { Cover, Flash, Photo } from '../components/ui';

const C = CONFIG.colors;
const Z = CONFIG.safeZone;

// 2. Capas: uma capa nova a cada batida, empurrando a anterior
export const Capas: React.FC = () => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const per = Math.round((CONFIG.sceneSeconds.capas * fps) / CONFIG.capas.length);
  const k = Math.min(CONFIG.capas.length - 1, Math.floor(f / per));
  const local = f - k * per;
  const cur = CONFIG.capas[k];
  const width = 820;
  const cx = Z.side + (CONFIG.width - Z.side - Z.right) / 2;
  const top = Z.top + (CONFIG.height - Z.top - Z.bottom - (width * 4) / 3) / 2;
  const enter = spring({ frame: local, fps, config: { damping: 14, mass: 0.6 } });
  const dir = k % 2 ? -1 : 1;
  return (
    <AbsoluteFill style={{ background: C.background }}>
      <AbsoluteFill style={{ filter: 'blur(40px) brightness(0.45) saturate(1.2)', transform: 'scale(1.2)' }}>
        <Photo src={cur.photo} focus={cur.focus} />
      </AbsoluteFill>
      {k > 0 && (
        <div style={{ position: 'absolute', left: cx - width / 2, top, transform: `translateX(${-dir * interpolate(local, [0, 8], [0, 1100], { extrapolateRight: 'clamp' })}px) rotate(${-dir * 8}deg) scale(0.92)`, opacity: 0.9 }}>
          <Cover width={width} {...CONFIG.capas[k - 1]} />
        </div>
      )}
      <div style={{ position: 'absolute', left: cx - width / 2, top, transform: `translateX(${dir * (1 - enter) * 1100}px) rotate(${dir * (1 - enter) * 12 - dir * 2}deg)` }}>
        <Cover width={width} {...cur} zoom={interpolate(local, [0, per], [1.12, 1.02])} />
      </div>
      <Flash at={k * per + 4} frames={6} strength={0.7} />
      {f > durationInFrames && null}
    </AbsoluteFill>
  );
};
