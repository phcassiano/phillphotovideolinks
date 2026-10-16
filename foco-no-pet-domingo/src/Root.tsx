import React from 'react';
import { Composition } from 'remotion';
import { CONFIG, totalFrames } from './config';
import { Main, MainProps } from './Main';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="FocoNoPetDomingo"
    component={Main}
    durationInFrames={totalFrames}
    fps={CONFIG.fps}
    width={CONFIG.width}
    height={CONFIG.height}
    defaultProps={{ showSafeZones: false } satisfies MainProps}
  />
);
