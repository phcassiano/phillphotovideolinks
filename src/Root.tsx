import React from 'react';
import {CalculateMetadataFunction, Composition} from 'remotion';
import {getVideoMetadata} from '@remotion/media-utils';
import './fontes';
import {Reel} from './Reel';
import type {Mascara, ReelProps} from './tipos';
import {ALTURA, FPS, LARGURA, resolverSrc} from './util';
import mascaraPadrao from '../mascaras/padrao.json';

const DURACAO_FOTO_PADRAO = 8;
const DURACAO_MAXIMA_PADRAO = 90; // limite prático para Reels de notícia

const calcularDuracao: CalculateMetadataFunction<ReelProps> = async ({props}) => {
  const {midia, duracaoFoto, duracaoMaxima} = props.noticia;
  let segundos = duracaoFoto ?? DURACAO_FOTO_PADRAO;
  if (midia.tipo === 'video') {
    const meta = await getVideoMetadata(resolverSrc(midia.src));
    segundos = Math.min(meta.durationInSeconds, duracaoMaxima ?? DURACAO_MAXIMA_PADRAO);
  }
  return {durationInFrames: Math.max(1, Math.floor(segundos * FPS))};
};

const exemplo: ReelProps = {
  mascara: mascaraPadrao as Mascara,
  noticia: {
    midia: {tipo: 'video', src: 'exemplo/video.mp4'},
    pais: 'BR',
    editoria: 'Política',
    manchete: 'PT vai à guerra',
    mancheteDestaque: 'contra Flávio?',
    etiqueta: 'Polêmica',
    lead: 'Pedro Rousseff diz que PT irá à guerra contra Flávio Bolsonaro.',
    credito: 'vídeo: @luizbacci',
  },
};

export const Root: React.FC = () => (
  <Composition
    id="ReelNoticia"
    component={Reel}
    width={LARGURA}
    height={ALTURA}
    fps={FPS}
    durationInFrames={DURACAO_FOTO_PADRAO * FPS}
    defaultProps={exemplo}
    calculateMetadata={calcularDuracao}
  />
);
