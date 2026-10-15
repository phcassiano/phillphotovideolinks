import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { CONFIG } from '../config';
import { Backdrop, Reveal, Rule, SafeArea, useEnter } from '../components/ui';

const C = CONFIG.colors;

// 3. Bônus: foto impressa caindo + cartões de bônus
export const Bonus: React.FC = () => {
  const drop = useEnter(8, 14);
  const f = CONFIG.photoFocus.bonus;
  return (
    <AbsoluteFill>
      <Backdrop glowY={40} />
      <SafeArea>
        <Reveal>
          <div style={{ fontSize: 80, fontWeight: 900, lineHeight: 1.08, letterSpacing: -1.5, maxWidth: 900 }}>{CONFIG.bonus.title}</div>
        </Reveal>
        <div style={{ height: 30 }} />
        <Rule delay={6} />
        <div style={{ height: 50 }} />
        <div
          style={{
            background: '#FBF8F1', padding: '20px 20px 70px', borderRadius: 8, boxShadow: '0 30px 70px rgba(0,0,0,0.65)',
            transform: `translateY(${(1 - drop) * -500}px) rotate(${-14 + drop * 10}deg) scale(${1.25 - drop * 0.25})`, opacity: Math.min(1, drop * 2),
          }}
        >
          <Img src={staticFile(CONFIG.photos.bonus)} style={{ width: 430, height: 400, objectFit: 'cover', objectPosition: `${f.x * 100}% ${f.y * 100}%`, display: 'block' }} />
        </div>
        <div style={{ height: 50 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26, alignSelf: 'stretch' }}>
          {CONFIG.bonus.items.map((item, i) => {
            const plus = item.startsWith('+');
            return (
              <Reveal key={item} delay={30 + i * 18} from="right">
                <div
                  style={{
                    background: C.surface, border: `3px solid ${C.accent}`, borderRadius: 32, padding: '26px 36px',
                    fontSize: 60, fontWeight: 800, lineHeight: 1.15, textAlign: 'left',
                  }}
                >
                  {plus && <span style={{ color: C.accent }}>+ </span>}
                  {plus ? item.replace(/^\+\s*/, '') : item}
                </div>
              </Reveal>
            );
          })}
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};
