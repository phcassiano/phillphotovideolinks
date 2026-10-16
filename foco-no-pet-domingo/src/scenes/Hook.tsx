import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { CONFIG } from '../config';
import { SERIF } from '../fonts';
import { Flash, Photo, Reveal, SafeArea } from '../components/ui';

const C = CONFIG.colors;
const PHOTO_TOP = 470; // a foto começa abaixo do título "FOCO", deixando o rosto livre

// 1. Gancho: título de revista no topo, pet logo abaixo e a promessa sobre o corpo, não no rosto
export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const zoom = f < 6 ? interpolate(f, [0, 6], [1.3, 1.04]) : interpolate(f, [6, 90], [1.04, 1.1]);
  const L = CONFIG.hook.lines;
  return (
    <AbsoluteFill style={{ background: C.background }}>
      <div style={{ position: 'absolute', top: PHOTO_TOP, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        <Photo src={CONFIG.hook.photo} focus={CONFIG.hook.focus} zoom={zoom} />
      </div>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${C.background} 0px, ${C.background} ${PHOTO_TOP}px, ${C.background}00 ${PHOTO_TOP + 140}px, ${C.background}00 1120px, ${C.background}E6 1280px, ${C.background} 100%)`,
        }}
      />
      <SafeArea style={{ justifyContent: 'space-between', paddingBottom: 30 }}>
        <Reveal delay={2} from="pop">
          <div style={{ fontFamily: SERIF, fontSize: 250, lineHeight: 0.9, letterSpacing: -6 }}>{CONFIG.revista.masthead}</div>
        </Reveal>
        <div>
          {L.map((line, i) => {
            const last = i === L.length - 1;
            return (
              <Reveal key={line} delay={10 + i * 9} from="pop">
                <div
                  style={{
                    fontSize: last ? 84 : 76, fontWeight: 900, lineHeight: 1.12, letterSpacing: -2, textTransform: 'uppercase',
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
