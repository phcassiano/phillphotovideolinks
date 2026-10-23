import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  OffthreadVideo,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {FONTE_MANCHETE, FONTE_MONO, FONTE_TEXTO} from './fontes';
import type {Midia, ReelProps} from './tipos';
import {resolverSrc} from './util';

// Geometria em 1080x1920, proporcional ao vídeo de referência.
const CARD = {x: 249, y: 452, w: 582, h: 1030, raio: 26};
const LEAD_Y = 1525;

const useEntrada = (atraso: number, amortecimento = 14) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - atraso, fps, config: {damping: amortecimento, mass: 0.6}});
};

const MidiaPreenchida: React.FC<{midia: Midia; mudo?: boolean; style?: React.CSSProperties}> = ({
  midia,
  mudo,
  style,
}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const base: React.CSSProperties = {width: '100%', height: '100%', objectFit: 'cover', ...style};
  if (midia.tipo === 'video') {
    return <OffthreadVideo src={resolverSrc(midia.src)} muted={mudo} style={base} />;
  }
  // Foto: zoom lento (Ken Burns) para dar movimento.
  const zoom = interpolate(frame, [0, durationInFrames], [1.02, 1.14]);
  return (
    <Img
      src={resolverSrc(midia.src)}
      style={{...base, transform: `${style?.transform ?? ''} scale(${zoom})`}}
    />
  );
};

const Fundo: React.FC<ReelProps> = ({noticia, mascara}) => {
  const frame = useCurrentFrame();
  const bolhas = [
    {x: 120, y: 260, r: 170, v: 0.011, cor: 'rgba(255,255,255,0.10)'},
    {x: 900, y: 140, r: 120, v: 0.017, cor: 'rgba(255,255,255,0.14)'},
    {x: 850, y: 1700, r: 150, v: 0.013, cor: `${mascara.cores.brilhoInferior}88`},
    {x: 300, y: 1760, r: 110, v: 0.009, cor: `${mascara.cores.brilhoInferior}66`},
    {x: 140, y: 1300, r: 90, v: 0.015, cor: 'rgba(255,255,255,0.06)'},
  ];
  return (
    <AbsoluteFill style={{backgroundColor: '#05060a', overflow: 'hidden'}}>
      <MidiaPreenchida
        midia={noticia.midia}
        mudo
        style={{filter: 'blur(38px) brightness(0.32) saturate(1.2)', transform: 'scale(1.25)'}}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(55% 30% at 35% 32%, ${mascara.cores.brilhoSuperior}55, transparent 70%),
            radial-gradient(90% 22% at 50% 100%, ${mascara.cores.brilhoInferior}cc, transparent 75%),
            linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0.35) 100%)`,
        }}
      />
      {bolhas.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: b.x + Math.sin(frame * b.v + i) * 40 - b.r,
            top: b.y + Math.cos(frame * b.v * 0.8 + i) * 30 - b.r,
            width: b.r * 2,
            height: b.r * 2,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${b.cor}, transparent 70%)`,
            filter: 'blur(12px)',
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

const BandeiraBR: React.FC = () => (
  <svg width="38" height="27" viewBox="0 0 38 27">
    <rect width="38" height="27" rx="3" fill="#009b3a" />
    <path d="M19 3 L35 13.5 L19 24 L3 13.5 Z" fill="#fedf00" />
    <circle cx="19" cy="13.5" r="6" fill="#002776" />
  </svg>
);

const Verificado: React.FC<{tamanho: number}> = ({tamanho}) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
    <path
      fill="#1d9bf0"
      d="M12 1.5l2.6 1.9 3.2-.1 1 3 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3-3.2-.1L12 22.5l-2.6-1.9-3.2.1-1-3-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3 3.2.1z"
    />
    <path d="M7.5 12.3l3 3 6-6.2" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
  </svg>
);

// Ajusta o tamanho da fonte ao comprimento do texto (Anton ~0.46em por caractere).
const tamanhoQueCabe = (texto: string, larguraMax: number, max: number) =>
  Math.min(max, Math.floor(larguraMax / (Math.max(texto.length, 1) * 0.46)));

const Cabecalho: React.FC<ReelProps> = ({noticia, mascara}) => {
  const seloEntra = useEntrada(0);
  const linha1 = useEntrada(4);
  const faixa = useEntrada(10, 18);
  const etiqueta = useEntrada(18, 9);

  const destaque = noticia.mancheteDestaque?.toUpperCase() ?? '';
  const branco = noticia.manchete.toUpperCase();
  const umaLinha = branco.length + destaque.length <= 26;
  const fonte = umaLinha
    ? tamanhoQueCabe(`${branco}  ${destaque}`, 1000, 92)
    : Math.min(tamanhoQueCabe(branco, 980, 104), tamanhoQueCabe(destaque, 940, 104));

  const pecaDestaque = destaque && (
    <span
      style={{
        display: 'inline-block',
        marginLeft: umaLinha ? 18 : 0,
        background: mascara.cores.destaque,
        color: mascara.cores.textoDestaque,
        padding: '0 14px',
        // Margem negativa no recorte para não cortar acentos (Ê, Á) acima da caixa.
        clipPath: `inset(-30% ${(1 - faixa) * 100}% -10% 0)`,
      }}
    >
      {destaque}
    </span>
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: CARD.y - 30,
        left: 0,
        right: 0,
        transform: 'translateY(-100%)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div style={{display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch'}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
            marginLeft: 6,
            marginBottom: 22,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontFamily: FONTE_MONO,
              fontWeight: 500,
              fontSize: 25,
              letterSpacing: 2,
              color: 'rgba(255,255,255,0.75)',
              opacity: seloEntra,
            }}
          >
            {noticia.pais?.toUpperCase() === 'BR' && <BandeiraBR />}
            <span>
              {noticia.pais ? `${noticia.pais.toUpperCase()} · ` : ''}
              {noticia.editoria.toUpperCase()}
            </span>
          </div>
          {noticia.etiqueta && (
            <span
              style={{
                fontFamily: FONTE_MANCHETE,
                fontSize: 30,
                lineHeight: 1,
                padding: '7px 12px 6px',
                marginRight: 10,
                background: '#fff',
                color: '#111',
                border: '3px solid #111',
                borderRadius: 4,
                transform: `rotate(-4deg) scale(${etiqueta})`,
              }}
            >
              {noticia.etiqueta.toUpperCase()}
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: FONTE_MANCHETE,
            fontSize: fonte,
            lineHeight: 1.08,
            color: '#fff',
            textShadow: '0 4px 18px rgba(0,0,0,0.5)',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              opacity: linha1,
              transform: `translateY(${(1 - linha1) * 40}px)`,
            }}
          >
            {branco}
          </span>
          {umaLinha ? pecaDestaque : <div style={{marginTop: 6}}>{pecaDestaque}</div>}
        </div>
      </div>
    </div>
  );
};

const Card: React.FC<ReelProps> = ({noticia, mascara}) => {
  const entra = useEntrada(6, 16);
  const faixaSobe = useEntrada(16, 15);
  const {perfil} = mascara;
  return (
    <div
      style={{
        position: 'absolute',
        left: CARD.x,
        top: CARD.y,
        width: CARD.w,
        height: CARD.h,
        borderRadius: CARD.raio,
        overflow: 'hidden',
        border: '3px solid rgba(255,255,255,0.85)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        opacity: entra,
        transform: `scale(${interpolate(entra, [0, 1], [0.9, 1])})`,
        backgroundColor: '#000',
      }}
    >
      <MidiaPreenchida midia={noticia.midia} />

      {noticia.credito && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            padding: '6px 14px',
            borderRadius: 8,
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            fontFamily: FONTE_MONO,
            fontSize: 20,
          }}
        >
          {noticia.credito}
        </div>
      )}
      {mascara.logo && (
        <Img
          src={resolverSrc(mascara.logo)}
          style={{
            position: 'absolute',
            top: noticia.credito ? 62 : 16,
            right: 16,
            width: 74,
            height: 74,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '3px solid #fff',
            background: '#fff',
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 150,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '28px 26px 0',
          background: `linear-gradient(180deg, transparent 0%, ${mascara.cores.faixaPerfil}dd 35%, ${mascara.cores.faixaPerfil} 100%)`,
          transform: `translateY(${(1 - faixaSobe) * 150}px)`,
        }}
      >
        {perfil.avatar && (
          <Img
            src={resolverSrc(perfil.avatar)}
            style={{
              width: 104,
              height: 104,
              borderRadius: '50%',
              objectFit: 'cover',
              border: `4px solid ${mascara.cores.destaque}`,
              flexShrink: 0,
            }}
          />
        )}
        <div style={{fontFamily: FONTE_TEXTO, color: '#fff', lineHeight: 1.15, minWidth: 0}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 38}}>
            <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
              {perfil.nome}
            </span>
            {perfil.verificado && <Verificado tamanho={34} />}
          </div>
          <div style={{fontWeight: 600, fontSize: 30, opacity: 0.85}}>@{perfil.handle}</div>
        </div>
      </div>
    </div>
  );
};

const Lead: React.FC<ReelProps> = ({noticia, mascara}) => {
  const barra = useEntrada(14, 20);
  const texto = useEntrada(20, 18);
  const fonte = noticia.lead.length > 120 ? 38 : noticia.lead.length > 80 ? 42 : 46;
  return (
    <div
      style={{
        position: 'absolute',
        top: LEAD_Y,
        left: 72,
        right: 72,
        display: 'flex',
        gap: 26,
      }}
    >
      <div
        style={{
          width: 8,
          borderRadius: 4,
          background: mascara.cores.destaque,
          transform: `scaleY(${barra})`,
          transformOrigin: 'top',
        }}
      />
      <div
        style={{
          fontFamily: FONTE_TEXTO,
          fontWeight: 700,
          fontSize: fonte,
          lineHeight: 1.22,
          color: '#fff',
          textShadow: '0 3px 14px rgba(0,0,0,0.6)',
          opacity: texto,
          transform: `translateX(${(1 - texto) * -24}px)`,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {noticia.lead}
      </div>
    </div>
  );
};

export const Reel: React.FC<ReelProps> = (props) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  // Fade-out curto no final para o loop do Reels não "pular".
  const saida = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  });
  return (
    <AbsoluteFill style={{opacity: saida, backgroundColor: '#000'}}>
      <Fundo {...props} />
      <Cabecalho {...props} />
      <Card {...props} />
      <Lead {...props} />
      {props.mascara.overlayPng && (
        <AbsoluteFill>
          <Img src={resolverSrc(props.mascara.overlayPng)} style={{width: '100%', height: '100%'}} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
