import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { CONFIG, SCENES, SceneKey } from './config';
import { SafeZoneGuides } from './components/ui';
import { Hook } from './scenes/Hook';
import { Oferta } from './scenes/Oferta';
import { Bonus } from './scenes/Bonus';
import { Escassez } from './scenes/Escassez';
import { Presente } from './scenes/Presente';
import { Cta } from './scenes/Cta';
import './fonts';

export type MainProps = { showSafeZones: boolean };

const COMPONENTS: Record<SceneKey, React.FC> = { hook: Hook, oferta: Oferta, bonus: Bonus, escassez: Escassez, presente: Presente, cta: Cta };
const T = CONFIG.transitionFrames;

// Cada cena (menos a última) ganha T frames a mais, que se sobrepõem ao fade.
// Assim cada cena começa exatamente no segundo definido no config e o total fica igual à soma.
export const Main: React.FC<MainProps> = ({ showSafeZones }) => (
  <AbsoluteFill style={{ background: CONFIG.colors.background }}>
    <TransitionSeries>
      {SCENES.flatMap((key, i) => {
        const Scene = COMPONENTS[key];
        const last = i === SCENES.length - 1;
        const items = [
          <TransitionSeries.Sequence key={key} durationInFrames={CONFIG.sceneSeconds[key] * CONFIG.fps + (last ? 0 : T)}>
            <Scene />
          </TransitionSeries.Sequence>,
        ];
        if (!last) items.push(<TransitionSeries.Transition key={`${key}-t`} presentation={fade()} timing={linearTiming({ durationInFrames: T })} />);
        return items;
      })}
    </TransitionSeries>
    {showSafeZones && <SafeZoneGuides />}
  </AbsoluteFill>
);
