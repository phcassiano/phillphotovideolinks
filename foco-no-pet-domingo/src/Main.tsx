import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { CONFIG, SCENES, SceneKey, sceneFrames } from './config';
import { SafeZoneGuides } from './components/ui';
import { Hook } from './scenes/Hook';
import { Capas } from './scenes/Capas';
import { Passos } from './scenes/Passos';
import { Data } from './scenes/Data';
import { Cta } from './scenes/Cta';
import './fonts';

export type MainProps = { showSafeZones: boolean };

const COMPONENTS: Record<SceneKey, React.FC> = { hook: Hook, capas: Capas, passos: Passos, data: Data, cta: Cta };
const T = CONFIG.transitionFrames;
// transição de saída de cada cena
const OUT: Partial<Record<SceneKey, 'fade' | 'slide'>> = { hook: 'fade', capas: 'slide', passos: 'slide', data: 'fade' };

// Cada cena (menos a última) ganha T frames que se sobrepõem à transição,
// então cada uma começa no segundo definido no config e o total é a soma.
export const Main: React.FC<MainProps> = ({ showSafeZones }) => (
  <AbsoluteFill style={{ background: CONFIG.colors.background }}>
    <TransitionSeries>
      {SCENES.flatMap((key, i) => {
        const Scene = COMPONENTS[key];
        const last = i === SCENES.length - 1;
        const out = [
          <TransitionSeries.Sequence key={key} durationInFrames={sceneFrames(key) + (last ? 0 : T)}>
            <Scene />
          </TransitionSeries.Sequence>,
        ];
        if (!last) out.push(
          <TransitionSeries.Transition key={`${key}-t`} presentation={OUT[key] === 'slide' ? slide({ direction: 'from-bottom' }) : fade()} timing={linearTiming({ durationInFrames: T })} />,
        );
        return out;
      })}
    </TransitionSeries>
    <Audio src={staticFile('sfx.wav')} />
    {showSafeZones && <SafeZoneGuides />}
  </AbsoluteFill>
);
