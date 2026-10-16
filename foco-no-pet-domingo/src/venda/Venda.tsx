import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CONFIG } from '../config';
import { SANS } from '../fonts';
import { Flash, SafeArea, SafeZoneGuides } from '../components/ui';
import { montagemTimeline, VENDA, VENDA_SCENES, VendaKey, vFrames, vStart } from './config';
import { SHAKES } from './cues';

const C = CONFIG.colors;
const FPS = CONFIG.fps;

// ---------- peças ----------
export const pop = (frame: number, delay: number, fps: number, damping = 11) => spring({ frame: frame - delay, fps, config: { damping, mass: 0.6 } });

export const Fill: React.FC<{ src?: string; video?: string; fit?: 'cover' | 'contain'; pos?: string; style?: React.CSSProperties }> = ({ src, video, fit = 'cover', pos = '50% 35%', style }) =>
  video ? (
    <OffthreadVideo src={staticFile(video)} muted startFrom={10} style={{ width: '100%', height: '100%', objectFit: fit, objectPosition: pos, ...style }} />
  ) : (
    <Img src={staticFile(src!)} style={{ width: '100%', height: '100%', objectFit: fit, objectPosition: pos, ...style }} />
  );

/** Foto inteira (sem corte) sobre a mesma foto desfocada. */
export const WholePhoto: React.FC<{ src?: string; video?: string; zoom?: number }> = ({ src, video, zoom = 1 }) => (
  <AbsoluteFill>
    <AbsoluteFill style={{ filter: 'blur(36px) brightness(0.55)', transform: 'scale(1.25)' }}><Fill src={src} video={video} /></AbsoluteFill>
    <AbsoluteFill style={{ transform: `scale(${zoom})` }}><Fill src={src} video={video} fit="contain" /></AbsoluteFill>
  </AbsoluteFill>
);

export const Big: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({ children, size = 96, color = C.text, style }) => (
  <div style={{ fontSize: size, fontWeight: 900, lineHeight: 1.05, letterSpacing: -2, color, textShadow: '0 6px 30px rgba(0,0,0,0.55)', ...style }}>{children}</div>
);

export const Hi: React.FC<{ children: React.ReactNode; rot?: number }> = ({ children, rot = -2 }) => (
  <span style={{ background: C.accent, padding: '0 20px', borderRadius: 14, display: 'inline-block', transform: `rotate(${rot}deg)` }}>{children}</span>
);

// ---------- 1. gancho: rolo da câmera infinito ----------
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const H = VENDA.hook;
  const photos = ['p00', 'p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10', 'p11', 'p12', 'p13'];
  const scroll = f * 46;
  const cell = 270;
  const n = Math.round(interpolate(f, [0, 40], [H.contador - 400, H.contador], { extrapolateRight: 'clamp' }));
  const l2 = pop(f, 40, fps, 9);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-(scroll % (cell * 7))}px)` }}>
        {Array.from({ length: 4 * 16 }, (_, i) => (
          <div key={i} style={{ position: 'absolute', left: (i % 4) * cell, top: Math.floor(i / 4) * cell, width: cell - 4, height: cell - 4, overflow: 'hidden' }}>
            <Fill src={`photos/${photos[(i * 5) % photos.length]}.jpg`} style={{ filter: `blur(${2 + (i % 3) * 2}px) brightness(${0.55 + (i % 4) * 0.08}) saturate(0.6)`, transform: `rotate(${(i % 5) - 2}deg) scale(1.1)` }} />
          </div>
        ))}
      </div>
      <AbsoluteFill style={{ background: 'radial-gradient(70% 45% at 50% 55%, rgba(0,0,0,0.25), rgba(0,0,0,0.8))' }} />
      <SafeArea style={{ justifyContent: 'space-between' }}>
        <div style={{ background: 'rgba(0,0,0,0.65)', borderRadius: 999, padding: '10px 34px', fontSize: 56, fontWeight: 800, marginTop: 10 }}>
          📱 {n.toLocaleString('pt-BR')} fotos
        </div>
        <div>
          <Big size={84} style={{ opacity: pop(f, 4, fps, 200), transform: `translateY(${(1 - pop(f, 4, fps, 200)) * 60}px)` }}>{H.linha1}</Big>
          <div style={{ height: 40 }} />
          <Big size={92} style={{ opacity: Math.min(1, l2 * 2), transform: `scale(${0.4 + 0.6 * l2})` }}>
            {H.linha2[0]} <Hi>{H.linha2[1]}</Hi> {H.linha2[2]}
          </Big>
        </div>
        <div />
      </SafeArea>
    </AbsoluteFill>
  );
};

// ---------- 2. dor: "fotos de celular" ----------
const Dor: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const per = Math.round(vFrames('dor') / VENDA.dor.length);
  const k = Math.min(VENDA.dor.length - 1, Math.floor(f / per));
  const d = VENDA.dor[k];
  const local = f - k * per;
  const st = pop(local, 5, fps, 10);
  const x = pop(local, 12, fps, 14);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AbsoluteFill style={{ filter: d.filter, transform: `rotate(${d.rotate}deg) scale(${d.zoom})`, transformOrigin: '50% 100%' }}>
        <Fill src={d.photo} pos="50% 100%" />
      </AbsoluteFill>
      <SafeArea style={{ justifyContent: 'flex-end', paddingBottom: 30 }}>
        <div style={{ position: 'relative', transform: `scale(${2.2 - 1.2 * st}) rotate(-6deg)`, opacity: Math.min(1, st * 2) }}>
          <div style={{ border: `10px solid ${C.text}`, borderRadius: 20, padding: '10px 34px', fontSize: 96, fontWeight: 900, background: 'rgba(0,0,0,0.45)' }}>{d.label}</div>
        </div>
      </SafeArea>
      <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0, opacity: x }}>
        <path d={`M200 520 L${200 + 680 * x} ${520 + 880 * x}`} stroke="#FF2D2D" strokeWidth="34" strokeLinecap="round" />
        <path d={`M880 520 L${880 - 680 * x} ${520 + 880 * x}`} stroke="#FF2D2D" strokeWidth="34" strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', top: CONFIG.safeZone.top + 10, left: 0, right: 0, textAlign: 'center', fontFamily: SANS, fontSize: 60, fontWeight: 900, color: '#fff', textShadow: '0 4px 20px #000' }}>
        Foto de celular 😩
      </div>
      <Flash at={k * per} frames={4} strength={0.6} />
    </AbsoluteFill>
  );
};

// ---------- 3. virada ----------
const Virada: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = pop(f, 2, fps, 9);
  return (
    <AbsoluteFill style={{ background: C.accent }}>
      <SafeArea style={{ justifyContent: 'center' }}>
        <Big size={130} style={{ transform: `scale(${0.3 + 0.7 * p}) rotate(${(1 - p) * -12}deg)`, opacity: Math.min(1, p * 2) }}>{VENDA.virada}</Big>
      </SafeArea>
    </AbsoluteFill>
  );
};

// ---------- 4. montagem rápida ----------
const PH_TOP = CONFIG.safeZone.top + 120, PH_H = CONFIG.height - CONFIG.safeZone.bottom - PH_TOP;
const Montagem: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const M = VENDA.montagem;
  const TL = montagemTimeline();
  const k = Math.max(0, TL.findIndex((t) => f >= t.start && f < t.start + t.dur));
  const { start, dur: per } = TL[k];
  const local = f - start;
  // clipe animado: tela cheia por 1 s; foto parada: alterna inteira / dividida em 2
  const layout = M[k].video ? 0 : k % 2 ? 1 : 0;
  const punch = interpolate(local, [0, 4, per], [1.12, 1.02, 1], { extrapolateRight: 'clamp' });
  const selo = VENDA.selos[Math.floor((k / M.length) * VENDA.selos.length)];
  const sp = pop(local, 0, fps, 12);
  const a = M[k], b = M[(k + 1) % M.length];
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AbsoluteFill style={{ filter: 'blur(36px) brightness(0.45)', transform: 'scale(1.25)' }}><Fill src={a.photo} video={a.video} /></AbsoluteFill>
      {/* área das fotos: abaixo da faixa do selo, sem texto por cima */}
      <Sequence from={start} durationInFrames={per} style={{ top: PH_TOP, height: PH_H, bottom: 'auto' }}>
        {layout === 1 ? (
          <>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '50%', overflow: 'hidden', borderBottom: `8px solid ${C.accent}` }}>
              <WholePhoto src={a.photo} video={a.video} zoom={punch} />
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%', overflow: 'hidden', transform: `translateX(${(1 - sp) * 600}px)` }}>
              <WholePhoto src={b.photo} video={b.video} zoom={punch} />
            </div>
          </>
        ) : (
          <AbsoluteFill style={{ overflow: 'hidden' }}><WholePhoto src={a.photo} video={a.video} zoom={a.video ? 1 : punch} /></AbsoluteFill>
        )}
      </Sequence>
      <div style={{ position: 'absolute', top: CONFIG.safeZone.top, left: CONFIG.safeZone.side, right: CONFIG.safeZone.right, display: 'flex', justifyContent: 'center', fontFamily: SANS }}>
        <div key={selo} style={{ background: '#fff', color: C.dark, borderRadius: 999, padding: '12px 30px', fontSize: 52, fontWeight: 900, whiteSpace: 'nowrap', transform: `scale(${0.9 + 0.1 * pop(local, 0, fps, 10)})` }}>
          {selo}
        </div>
      </div>
      <Flash at={start} frames={3} strength={0.5} />
    </AbsoluteFill>
  );
};

// ---------- 5. oferta ----------
const Oferta: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rows = [
    { t: `📅 Domingo ${CONFIG.domingo}`, big: true },
    { t: `⏰ ${CONFIG.horario}` },
    { t: `📍 ${CONFIG.local}` },
    { t: CONFIG.cidade, small: true },
  ];
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: 'blur(30px) brightness(0.4)', transform: 'scale(1.2)' }}><Fill src={VENDA.oferta.foto} /></AbsoluteFill>
      <SafeArea style={{ justifyContent: 'center', gap: 30 }}>
        <Big size={80} color={C.accentSoft} style={{ opacity: pop(f, 0, fps, 200) }}>{VENDA.oferta.titulo}</Big>
        {rows.map((r, i) => {
          const p = pop(f, 8 + i * 8, fps, 12);
          return (
            <div key={r.t} style={{ alignSelf: 'stretch', transform: `translateX(${(1 - p) * (i % 2 ? -900 : 900)}px)`, opacity: Math.min(1, p * 2) }}>
              <div style={{ background: r.big ? C.accent : 'rgba(255,255,255,0.95)', color: r.big ? '#fff' : C.dark, borderRadius: 30, padding: r.small ? '14px 30px' : '22px 30px', fontSize: r.big ? 92 : r.small ? 58 : 70, fontWeight: 900, lineHeight: 1.1 }}>
                {r.t}
              </div>
            </div>
          );
        })}
      </SafeArea>
    </AbsoluteFill>
  );
};

// ---------- 6. urgência ----------
const Urgencia: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulse = 1 + 0.04 * Math.sin(f / 3);
  return (
    <AbsoluteFill style={{ background: C.dark }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 40% at 50% 50%, ${C.accent}55, transparent 70%)` }} />
      <SafeArea style={{ justifyContent: 'center', gap: 20 }}>
        {VENDA.urgencia.map((l, i) => {
          const p = pop(f, i * 8, fps, 10);
          return <Big key={l} size={i ? 108 : 92} color={i ? C.accentSoft : C.text} style={{ transform: `scale(${(0.4 + 0.6 * p) * (i ? pulse : 1)})`, opacity: Math.min(1, p * 2) }}>{l}</Big>;
        })}
      </SafeArea>
    </AbsoluteFill>
  );
};

// ---------- 7. emoção ----------
const Emocao: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const z = interpolate(f, [0, vFrames('emocao')], [1, 1.08]);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AbsoluteFill style={{ filter: 'blur(36px) brightness(0.4)', transform: 'scale(1.25)' }}><Fill src="photos/p13.jpg" /></AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, right: 0, top: CONFIG.safeZone.top, height: 1150 - CONFIG.safeZone.top, overflow: 'hidden' }}>
        <AbsoluteFill style={{ transform: `scale(${z})` }}><Fill video={VENDA.emocaoClip} fit="contain" /></AbsoluteFill>
      </div>
      <SafeArea style={{ justifyContent: 'flex-end' }}>
        {VENDA.emocao.map((l, i) => {
          const p = pop(f, i * 10, fps, 200);
          return <Big key={l} size={i === 2 ? 104 : 80} color={i === 2 ? C.accentSoft : C.text} style={{ opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>{l}</Big>;
        })}
      </SafeArea>
    </AbsoluteFill>
  );
};

// ---------- 8. chamada ----------
const Cta: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulse = 1 + 0.035 * Math.sin(f / 4);
  const T = VENDA.cta;
  const p = (d: number) => pop(f, d, fps, 11);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(70% 45% at 50% 40%, ${C.accent}50 0%, ${C.background} 72%)` }}>
      <SafeArea style={{ justifyContent: 'center', gap: 44 }}>
        <Big size={98} style={{ transform: `scale(${0.4 + 0.6 * p(0)})`, opacity: Math.min(1, p(0) * 2) }}>{T.titulo}</Big>
        <div style={{ transform: `scale(${(0.4 + 0.6 * p(10)) * pulse})`, opacity: Math.min(1, p(10) * 2), background: '#25D366', color: '#fff', borderRadius: 48, padding: '24px 50px', boxShadow: '0 20px 60px rgba(37,211,102,0.35)' }}>
          <div style={{ fontSize: 58, fontWeight: 800 }}>{T.whats} 👇</div>
          <div style={{ fontSize: 84, fontWeight: 900, letterSpacing: -1 }}>{CONFIG.whatsapp}</div>
        </div>
        <Big size={80} style={{ transform: `scale(${0.4 + 0.6 * p(22)})`, opacity: Math.min(1, p(22) * 2) }}>
          {T.comenta} <Hi rot={-3}>{T.palavra}</Hi> 💬
        </Big>
      </SafeArea>
    </AbsoluteFill>
  );
};

const COMPONENTS: Record<VendaKey, React.FC> = { hook: Hook, dor: Dor, virada: Virada, montagem: Montagem, oferta: Oferta, urgencia: Urgencia, emocao: Emocao, cta: Cta };

export type VendaProps = { showSafeZones: boolean };

export const Venda: React.FC<VendaProps> = ({ showSafeZones }) => {
  const f = useCurrentFrame();
  let dx = 0, dy = 0;
  for (const [t0, amp] of SHAKES) {
    const d = f / FPS - t0;
    if (d >= 0 && d < 0.35) { const k = amp * Math.exp(-d * 12); dx += Math.sin(d * 90 + t0) * k; dy += Math.cos(d * 70 + t0) * k; }
  }
  return (
    <AbsoluteFill style={{ background: '#000', fontFamily: SANS, color: C.text }}>
      <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px) scale(1.02)` }}>
        {VENDA_SCENES.map((k) => {
          const S = COMPONENTS[k];
          return (
            <Sequence key={k} from={vStart(k)} durationInFrames={vFrames(k)}>
              <S />
            </Sequence>
          );
        })}
      </AbsoluteFill>
      {VENDA_SCENES.slice(1).map((k) => (
        <Sequence key={`f-${k}`} from={vStart(k)} durationInFrames={6}><Flash frames={5} strength={0.75} /></Sequence>
      ))}
      <Audio src={staticFile('sfx-venda.wav')} />
      {showSafeZones && <SafeZoneGuides />}
    </AbsoluteFill>
  );
};
