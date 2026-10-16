import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CONFIG } from '../config';
import { SANS } from '../fonts';
import { Flash, SafeArea, SafeZoneGuides } from '../components/ui';
import { Big, Fill, Hi, WholePhoto, pop } from '../venda/Venda';
import { Cena, FALA, FALA_SCENES, FalaKey, fFrames, fStart } from './config';
import { SHAKES } from './cues';

const C = CONFIG.colors;
const Z = CONFIG.safeZone;
const PET_TOP = 700; // o pet fica abaixo do balão: nenhuma fala cobre o rosto

/** Balão de fala com texto "digitando". Mostra a fala mais recente. */
const Balao: React.FC<{ falas: Cena['falas']; emo?: boolean }> = ({ falas, emo }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const idx = falas.reduce((acc, x, i) => (t >= x.at ? i : acc), -1);
  if (idx < 0) return null;
  const cur = falas[idx];
  const since = (t - cur.at) * fps;
  const chars = Array.from(cur.text);
  const n = Math.min(chars.length, Math.floor(since * (emo ? 1.2 : 2)) + 1);
  const p = pop(since, 0, fps, emo ? 200 : 12);
  return (
    <div style={{ position: 'relative', transform: `scale(${0.7 + 0.3 * p})`, opacity: Math.min(1, p * 2), alignSelf: 'stretch' }}>
      <div
        style={{
          background: emo ? 'rgba(255,255,255,0.12)' : '#fff', color: emo ? '#fff' : C.dark, border: emo ? '3px solid rgba(255,255,255,0.5)' : 'none',
          borderRadius: 40, padding: '30px 36px', fontSize: emo ? 70 : 74, fontWeight: emo ? 800 : 900, lineHeight: 1.12, textAlign: 'center',
          boxShadow: emo ? 'none' : '0 20px 50px rgba(0,0,0,0.35)', minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span>
          {chars.slice(0, n).join('')}
          <span style={{ opacity: 0 }}>{chars.slice(n).join('')}</span>
        </span>
      </div>
      {!emo && <div style={{ position: 'absolute', left: '50%', bottom: -28, marginLeft: -30, width: 0, height: 0, borderLeft: '30px solid transparent', borderRight: '30px solid transparent', borderTop: '34px solid #fff' }} />}
    </div>
  );
};

const CenaPet: React.FC<{ cena: Cena }> = ({ cena }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const emo = cena.mood === 'emo';
  const shaky = cena.tremida !== undefined && t >= cena.tremida;
  const jx = shaky ? Math.sin(f * 2.3) * 14 : 0, jy = shaky ? Math.cos(f * 1.9) * 10 : 0;
  const zoom = interpolate(f, [0, fFrames('emocao')], [1, emo ? 1.08 : 1.03]);
  return (
    <AbsoluteFill style={{ background: emo ? '#050505' : C.accent }}>
      {!emo && <AbsoluteFill style={{ background: `radial-gradient(70% 50% at 50% 70%, ${C.accentSoft} 0%, ${C.accent} 70%)` }} />}
      {/* o pet, abaixo do balão */}
      <div style={{ position: 'absolute', left: 40, right: Z.right - 20, top: PET_TOP, bottom: Z.bottom - 40, overflow: 'hidden', borderRadius: 36, boxShadow: '0 30px 70px rgba(0,0,0,0.4)' }}>
        <AbsoluteFill style={{ transform: `translate(${jx}px, ${jy}px) scale(${zoom})`, filter: shaky ? 'blur(7px) saturate(0.7)' : emo ? 'saturate(0.85)' : 'none' }}>
          <WholePhoto src={cena.photo} video={cena.clip} />
        </AbsoluteFill>
        {shaky && (
          <div style={{ position: 'absolute', top: 24, left: 24, background: 'rgba(0,0,0,0.7)', color: '#fff', fontFamily: SANS, fontSize: 48, fontWeight: 900, padding: '8px 22px', borderRadius: 16 }}>📱 foto de celular</div>
        )}
      </div>
      {emo && <AbsoluteFill style={{ background: `radial-gradient(80% 60% at 50% 70%, transparent 40%, rgba(0,0,0,${interpolate(f, [0, 30], [0, 0.6], { extrapolateRight: 'clamp' })}) 100%)` }} />}
      <SafeArea style={{ justifyContent: 'flex-start', gap: 26 }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: '#fff', background: 'rgba(0,0,0,0.35)', padding: '8px 24px', borderRadius: 999, opacity: emo ? 0.7 : 1 }}>{FALA.tag}</div>
        <Balao falas={cena.falas} emo={emo} />
      </SafeArea>
    </AbsoluteFill>
  );
};

const Pedido: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rows = [`📅 Domingo ${CONFIG.domingo}`, `⏰ ${CONFIG.horario}`, `📍 ${CONFIG.local}`, CONFIG.cidade];
  const pt = pop(f, 0, fps, 9);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: 'blur(30px) brightness(0.45)', transform: 'scale(1.2)' }}><Fill src={FALA.pedido.foto} /></AbsoluteFill>
      <SafeArea style={{ justifyContent: 'center', gap: 28 }}>
        <Big size={150} style={{ transform: `scale(${0.3 + 0.7 * pt}) rotate(${(1 - pt) * -10}deg)`, opacity: Math.min(1, pt * 2) }}>{FALA.pedido.titulo}</Big>
        {rows.map((r, i) => {
          const p = pop(f, 15 + i * 7, fps, 12);
          return (
            <div key={r} style={{ alignSelf: 'stretch', transform: `translateY(${(1 - p) * 120}px)`, opacity: Math.min(1, p * 2) }}>
              <div style={{ background: i === 0 ? C.accent : '#fff', color: i === 0 ? '#fff' : C.dark, borderRadius: 28, padding: '18px 26px', fontSize: i === 0 ? 84 : i === 3 ? 56 : 66, fontWeight: 900, lineHeight: 1.1 }}>{r}</div>
            </div>
          );
        })}
      </SafeArea>
    </AbsoluteFill>
  );
};

const Cta: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const T = FALA.cta;
  const pulse = 1 + 0.035 * Math.sin(f / 4);
  const p = (d: number) => pop(f, d, fps, 11);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(70% 45% at 50% 40%, ${C.accent}55 0%, ${C.background} 72%)` }}>
      <SafeArea style={{ justifyContent: 'center', gap: 36 }}>
        <Big size={84} style={{ transform: `scale(${0.4 + 0.6 * p(0)})`, opacity: Math.min(1, p(0) * 2) }}>{T.marca}</Big>
        <div style={{ transform: `scale(${(0.4 + 0.6 * p(14)) * pulse})`, opacity: Math.min(1, p(14) * 2), background: '#25D366', color: '#fff', borderRadius: 48, padding: '22px 46px' }}>
          <div style={{ fontSize: 56, fontWeight: 800 }}>{T.whats} 👇</div>
          <div style={{ fontSize: 82, fontWeight: 900, letterSpacing: -1 }}>{CONFIG.whatsapp}</div>
        </div>
        <Big size={74} style={{ transform: `scale(${0.4 + 0.6 * p(27)})`, opacity: Math.min(1, p(27) * 2) }}>{T.comenta} <Hi rot={-3}>{T.palavra}</Hi> 🐾</Big>
        <div style={{ fontSize: 56, fontWeight: 800, color: C.accentSoft, opacity: p(40) }}>{T.urgencia}</div>
      </SafeArea>
    </AbsoluteFill>
  );
};

export type FalaProps = { showSafeZones: boolean };

export const FalaReel: React.FC<FalaProps> = ({ showSafeZones }) => {
  const f = useCurrentFrame();
  let dx = 0, dy = 0;
  for (const [t0, amp] of SHAKES) {
    const d = f / CONFIG.fps - t0;
    if (d >= 0 && d < 0.35) { const k = amp * Math.exp(-d * 12); dx += Math.sin(d * 90 + t0) * k; dy += Math.cos(d * 70 + t0) * k; }
  }
  const render = (k: FalaKey) => (k === 'pedido' ? <Pedido /> : k === 'cta' ? <Cta /> : <CenaPet cena={FALA.cenas[k]} />);
  return (
    <AbsoluteFill style={{ background: '#000', fontFamily: SANS, color: C.text }}>
      <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px) scale(1.02)` }}>
        {FALA_SCENES.map((k) => (
          <Sequence key={k} from={fStart(k)} durationInFrames={fFrames(k)}>{render(k)}</Sequence>
        ))}
      </AbsoluteFill>
      {FALA_SCENES.slice(1).filter((k) => k !== 'emocao').map((k) => (
        <Sequence key={`f-${k}`} from={fStart(k)} durationInFrames={5}><Flash frames={4} strength={0.6} /></Sequence>
      ))}
      <Audio src={staticFile('sfx-fala.wav')} />
      {showSafeZones && <SafeZoneGuides />}
    </AbsoluteFill>
  );
};
