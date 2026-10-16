import React from 'react';
import { Composition } from 'remotion';
import { CONFIG, totalFrames } from './config';
import { Main, MainProps } from './Main';
import { Venda, VendaProps } from './venda/Venda';
import { vTotal } from './venda/config';

export const RemotionRoot: React.FC = () => (
  <>
  <Composition
    id="FocoNoPetDomingo"
    component={Main}
    durationInFrames={totalFrames}
    fps={CONFIG.fps}
    width={CONFIG.width}
    height={CONFIG.height}
    defaultProps={{ showSafeZones: false } satisfies MainProps}
  />
  <Composition
    id="FocoNoPetVenda"
    component={Venda}
    durationInFrames={vTotal}
    fps={CONFIG.fps}
    width={CONFIG.width}
    height={CONFIG.height}
    defaultProps={{ showSafeZones: false } satisfies VendaProps}
  />
  </>
);
