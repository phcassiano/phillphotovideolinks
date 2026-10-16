import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { CONFIG } from '../config';
import { SERIF } from '../fonts';
import { Flash, Photo, Reveal, SafeArea } from '../components/ui';

const C = CONFIG.colors;

// 1. Gancho: o pet em tela cheia já como capa, com o título entrando em batidas
export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const zoom = f < 6 ? interpolate(f, [0, 6], [1.35, 1.06]) : interpolate(f, [6, 90], [1.06, 1.14]);
  const L = CONFIG.hook.lines;
  return (
    <AbsoluteFill style={{ background: C.background }}>
      <Photo src={CONFIG.hook.photo} focus={CONFIG.hook.focus} zoom={zoom} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 42%, ${C.background}E0 66%, ${C.background} 100%)` }} />
      <SafeArea style={{ justifyContent: 'space-between', paddingBottom: 30 }}>
        <Reveal delay={2} from="pop">
          <div style={{ fontFamily: SERIF, fontSize: 250, lineHeight: 0.9, letterSpacing: -6, textShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>{CONFIG.revista.masthead}</div>
        </Reveal>
        <div>
          {L.map((line, i) => {
            const last = i === L.length - 1;
            return (
              <Reveal key={line} delay={10 + i * 9} from="pop">
                <div
                  style={{
                    fontSize: last ? 86 : 82, fontWeight: 900, lineHeight: 1.12, letterSpacing: -2, textTransform: 'uppercase',
                    ...(last ? { background: C.accent, padding: '4px 26px', display: 'inline-block', transform: 'rotate(-2deg)', marginTop: 10 } : {}),
                  }}
                >
                  {line}
                </div>
              </Reveal>
            );
          })}
        </div>
      </SafeArea>
      <Flash at={0} frames={8} strength={1} />
    </AbsoluteFill>
  );
};
