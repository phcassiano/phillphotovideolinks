// Análise local dos vídeos: volume (gritos), mudanças de imagem (ação) e trechos de áudio para transcrição.
// Áudio de MP4/MOV: demux com mp4box + WebCodecs AudioDecoder, lendo o arquivo em pedaços
// (funciona com lives de horas sem carregar tudo na memória).
// Outros formatos (MKV/WebM): plano B tocando o vídeo em 4x com um analisador de áudio.

const MP4Box = () => window.MP4Box;
const CHUNK = 8 * 1024 * 1024;

export const duracao = (file) =>
  new Promise((res, rej) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.src = URL.createObjectURL(file);
    v.onloadedmetadata = () => {
      const d = { duracao: v.duration, w: v.videoWidth, h: v.videoHeight };
      URL.revokeObjectURL(v.src);
      res(d);
    };
    v.onerror = () => rej(new Error("O navegador não conseguiu abrir este vídeo."));
  });

/* ------------------------- MP4: caixas de topo ------------------------- */

async function caixasTopo(file) {
  const boxes = [];
  let pos = 0;
  while (pos < file.size && boxes.length < 64) {
    const head = new DataView(await file.slice(pos, pos + 16).arrayBuffer());
    if (head.byteLength < 8) break;
    let size = head.getUint32(0);
    const type = String.fromCharCode(head.getUint8(4), head.getUint8(5), head.getUint8(6), head.getUint8(7));
    if (size === 1) size = Number(head.getBigUint64(8));
    else if (size === 0) size = file.size - pos;
    if (size < 8) break;
    boxes.push({ type, start: pos, size });
    pos += size;
  }
  return boxes;
}

function descricao(mp4, track) {
  const trak = mp4.getTrackById(track.id);
  const entry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
  if (!entry) return undefined;
  if (entry.esds) {
    // DecoderSpecificInfo (tag 5) dentro do ES_Descriptor
    const find = (d) => {
      if (!d) return null;
      if (d.tag === 5 && d.data) return d.data;
      for (const c of d.descs ?? []) {
        const r = find(c);
        if (r) return r;
      }
      return null;
    };
    const data = find(entry.esds.esd);
    return data ? new Uint8Array(data) : undefined;
  }
  return undefined;
}

/**
 * Decodifica o áudio de um MP4 em streaming.
 * onAudio(float32Mono, sampleRate, tSegundos) é chamado para cada bloco decodificado.
 * range = [inicio, fim] em segundos (opcional): só decodifica esse trecho.
 */
export async function decodificarAudioMp4(file, onAudio, { range = null, onProgress = () => {} } = {}) {
  if (!window.AudioDecoder) throw new Error("Seu navegador não tem WebCodecs. Use o Google Chrome atualizado.");
  const boxes = await caixasTopo(file);
  const moov = boxes.find((b) => b.type === "moov");
  const ftyp = boxes.find((b) => b.type === "ftyp");
  if (!moov) throw new Error("NAO_MP4");
  const mp4 = MP4Box().createFile();
  let decoder = null;
  let erro = null;
  let fimAlcancado = false;
  let track = null;

  const pronto = new Promise((res, rej) => {
    mp4.onError = (e) => rej(new Error("mp4box: " + e));
    mp4.onReady = (info) => {
      track = info.audioTracks?.[0];
      if (!track) return rej(new Error("Este vídeo não tem áudio."));
      let codec = track.codec.startsWith("mp4a") ? track.codec : track.codec.toLowerCase().startsWith("opus") ? "opus" : track.codec;
      if (codec === "mp4a.40") codec = "mp4a.40.2";
      decoder = new AudioDecoder({
        output: (ad) => {
          try {
            const n = ad.numberOfFrames;
            const ch = ad.numberOfChannels;
            const mono = new Float32Array(n);
            const tmp = new Float32Array(n);
            for (let c = 0; c < ch; c++) {
              ad.copyTo(tmp, { planeIndex: c, format: "f32-planar" });
              for (let i = 0; i < n; i++) mono[i] += tmp[i] / ch;
            }
            onAudio(mono, ad.sampleRate, ad.timestamp / 1e6);
          } finally {
            ad.close();
          }
        },
        error: (e) => (erro = e),
      });
      decoder.configure({
        codec,
        sampleRate: track.audio.sample_rate,
        numberOfChannels: track.audio.channel_count,
        description: descricao(mp4, track),
      });
      mp4.setExtractionOptions(track.id, null, { nbSamples: 500 });
      res();
    };
    mp4.onSamples = (id, _u, samples) => {
      for (const s of samples) {
        const t = s.cts / s.timescale;
        if (range && t > range[1] + 0.5) {
          fimAlcancado = true;
          break;
        }
        if (range && t < range[0] - 0.5) continue;
        decoder.decode(
          new EncodedAudioChunk({ type: "key", timestamp: (1e6 * s.cts) / s.timescale, duration: (1e6 * s.duration) / s.timescale, data: s.data }),
        );
      }
      mp4.releaseUsedSamples(id, samples[samples.length - 1].number + 1);
    };
  });

  const append = async (start, end) => {
    const buf = await file.slice(start, end).arrayBuffer();
    buf.fileStart = start;
    mp4.appendBuffer(buf);
  };

  // 1) ftyp + moov primeiro (funciona mesmo com o moov no final do arquivo, como nas gravações do OBS)
  if (ftyp) await append(ftyp.start, ftyp.start + ftyp.size);
  for (let p = moov.start; p < moov.start + moov.size; p += CHUNK) await append(p, Math.min(moov.start + moov.size, p + CHUNK));
  await pronto;
  mp4.start();

  // 2) dados (mdat) em pedaços, a partir do ponto mais próximo do trecho pedido
  let inicio = 0;
  if (range) {
    const sk = mp4.seek(Math.max(0, range[0] - 1), true);
    inicio = sk?.offset ?? 0;
  }
  const mdats = boxes.filter((b) => b.type === "mdat");
  const total = mdats.reduce((a, b) => a + b.size, 0) || file.size;
  let lido = 0;
  for (const m of mdats) {
    let p = Math.max(m.start, inicio);
    if (p >= m.start + m.size) continue;
    while (p < m.start + m.size && !fimAlcancado) {
      if (erro) throw erro;
      const end = Math.min(m.start + m.size, p + CHUNK);
      await append(p, end);
      lido += end - p;
      p = end;
      onProgress(Math.min(1, lido / (range ? Math.max(1, total * ((range[1] - range[0]) / Math.max(1, track.duration / track.timescale))) : total)));
      while (decoder.decodeQueueSize > 64) await new Promise((r) => setTimeout(r, 5));
    }
    if (fimAlcancado) break;
  }
  mp4.flush();
  await decoder.flush();
  decoder.close();
  if (erro) throw erro;
}

/* ------------------------- volume por janela ------------------------- */

export async function volume(file, dur, { passo = 0.25, onProgress = () => {} } = {}) {
  const n = Math.ceil(dur / passo) + 8;
  const soma = new Float64Array(n);
  const cont = new Float64Array(n);
  try {
    await decodificarAudioMp4(
      file,
      (mono, sr, t0) => {
        for (let i = 0; i < mono.length; i++) {
          const w = Math.floor((t0 + i / sr) / passo);
          if (w >= 0 && w < n) {
            soma[w] += mono[i] * mono[i];
            cont[w]++;
          }
        }
      },
      { onProgress },
    );
  } catch (e) {
    if (e.message !== "NAO_MP4" && !/codec|configure|Unsupported|NotSupported/i.test(String(e))) throw e;
    return volumeTocando(file, dur, { passo, onProgress });
  }
  return Array.from(soma, (s, i) => 10 * Math.log10(s / Math.max(1, cont[i]) + 1e-10));
}

/** Plano B: toca o vídeo em 4x (sem som pra você) e mede o volume em tempo real */
async function volumeTocando(file, dur, { passo, onProgress }) {
  const v = document.createElement("video");
  v.src = URL.createObjectURL(file);
  v.playbackRate = 4;
  const ctx = new AudioContext();
  const src = ctx.createMediaElementSource(v);
  const an = ctx.createAnalyser();
  an.fftSize = 2048;
  src.connect(an);
  const out = new Array(Math.ceil(dur / passo) + 8).fill(-90);
  const buf = new Float32Array(an.fftSize);
  await v.play();
  await new Promise((res) => {
    const tick = () => {
      an.getFloatTimeDomainData(buf);
      let s = 0;
      for (const x of buf) s += x * x;
      const w = Math.floor(v.currentTime / passo);
      out[w] = Math.max(out[w], 10 * Math.log10(s / buf.length + 1e-10));
      onProgress(v.currentTime / dur);
      if (v.ended || v.currentTime >= dur - 0.05) return res();
      setTimeout(tick, 15);
    };
    tick();
  });
  ctx.close();
  URL.revokeObjectURL(v.src);
  return out;
}

/* ------------------------- mudanças de imagem ------------------------- */

const seek = (v, t) =>
  new Promise((res) => {
    const done = () => {
      v.removeEventListener("seeked", done);
      res();
    };
    v.addEventListener("seeked", done);
    v.currentTime = t;
  });

export async function mudancasDeCena(file, dur, { onProgress = () => {} } = {}) {
  const v = document.createElement("video");
  v.muted = true;
  v.preload = "auto";
  v.src = URL.createObjectURL(file);
  await new Promise((r) => (v.onloadeddata = r));
  const c = document.createElement("canvas");
  c.width = 48;
  c.height = 27;
  const g = c.getContext("2d", { willReadFrequently: true });
  const passo = Math.max(1, dur / 1200);
  let prev = null;
  const diffs = [];
  for (let t = 0; t < dur; t += passo) {
    await seek(v, t);
    g.drawImage(v, 0, 0, c.width, c.height);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    if (prev) {
      let d = 0;
      for (let i = 0; i < px.length; i += 4) d += Math.abs(px[i] - prev[i]) + Math.abs(px[i + 1] - prev[i + 1]) + Math.abs(px[i + 2] - prev[i + 2]);
      diffs.push({ t, d: d / (px.length * 0.75) });
    }
    prev = px;
    onProgress(t / dur);
  }
  URL.revokeObjectURL(v.src);
  if (!diffs.length) return [];
  const m = diffs.reduce((a, x) => a + x.d, 0) / diffs.length;
  const sd = Math.sqrt(diffs.reduce((a, x) => a + (x.d - m) ** 2, 0) / diffs.length);
  return diffs.filter((x) => x.d > m + 1.5 * sd).map((x) => x.t);
}

/* ------------------------- thumbnail ------------------------- */

export async function thumbnail(file, t, w = 360) {
  const v = document.createElement("video");
  v.muted = true;
  v.src = URL.createObjectURL(file);
  await new Promise((r) => (v.onloadeddata = r));
  await seek(v, Math.min(t, v.duration - 0.1));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = Math.round((w * v.videoHeight) / v.videoWidth);
  c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
  URL.revokeObjectURL(v.src);
  return c.toDataURL("image/jpeg", 0.8);
}

/* ------------------------- áudio de um trecho (16 kHz, pra transcrever) ------------------------- */

export async function audioTrecho(file, inicio, fim) {
  const partes = [];
  let sr = 48000;
  try {
    await decodificarAudioMp4(
      file,
      (mono, rate, t0) => {
        sr = rate;
        const a = Math.max(0, Math.floor((inicio - t0) * rate));
        const b = Math.min(mono.length, Math.ceil((fim - t0) * rate));
        if (b > a) partes.push({ t0: t0 + a / rate, d: mono.subarray(a, b) });
      },
      { range: [inicio, fim] },
    );
  } catch (e) {
    if (e.message !== "NAO_MP4") throw e;
    return audioTrechoTocando(file, inicio, fim);
  }
  const len = Math.ceil((fim - inicio) * sr);
  const all = new Float32Array(len);
  for (const p of partes) all.set(p.d.subarray(0, Math.max(0, len - Math.round((p.t0 - inicio) * sr))), Math.max(0, Math.round((p.t0 - inicio) * sr)));
  return reamostrar(all, sr, 16000);
}

async function audioTrechoTocando(file, inicio, fim) {
  const v = document.createElement("video");
  v.src = URL.createObjectURL(file);
  const ctx = new AudioContext({ sampleRate: 16000 });
  const src = ctx.createMediaElementSource(v);
  const dest = ctx.createMediaStreamDestination();
  src.connect(dest);
  const rec = new MediaRecorder(dest.stream);
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  await seek(v, inicio);
  rec.start();
  await v.play();
  await new Promise((r) => {
    const t = () => (v.currentTime >= fim ? r() : setTimeout(t, 50));
    t();
  });
  v.pause();
  rec.stop();
  await new Promise((r) => (rec.onstop = r));
  const ab = await new Blob(chunks).arrayBuffer();
  const buf = await ctx.decodeAudioData(ab);
  ctx.close();
  return reamostrar(buf.getChannelData(0), buf.sampleRate, 16000);
}

async function reamostrar(data, de, para) {
  if (de === para) return data;
  const off = new OfflineAudioContext(1, Math.ceil((data.length * para) / de), para);
  const b = off.createBuffer(1, data.length, de);
  b.copyToChannel(data, 0);
  const s = off.createBufferSource();
  s.buffer = b;
  s.connect(off.destination);
  s.start();
  const r = await off.startRendering();
  return r.getChannelData(0);
}

/* ------------------------- pontuação dos momentos ------------------------- */

const mediana = (a) => {
  if (!a.length) return -90;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const norm = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const p = s[Math.floor(s.length * 0.98)] || 1;
  return arr.map((v) => Math.min(1, v / (p || 1)));
};

/** Etapa 1: candidatos a partir de volume + imagem */
export function candidatos({ dur, loud, cuts, passo = 0.25, n = 8, alvo = 30, min = 15, max = 60 }) {
  const T = Math.floor(dur);
  const k = Math.round(1 / passo);
  const porSeg = Array.from({ length: T }, (_, t) => Math.max(...loud.slice(t * k, t * k + k), -90));
  const spike = porSeg.map((v, t) => Math.max(0, v - mediana(porSeg.slice(Math.max(0, t - 30), Math.max(1, t - 2)))));
  const scene = Array.from({ length: T }, (_, t) => cuts.filter((c) => Math.abs(c - t) <= 3).length);
  const nS = norm(spike);
  const nC = norm(scene);
  const score = nS.map((v, t) => v + 0.6 * nC[t]);
  const order = score.map((s, t) => [s, t]).sort((a, b) => b[0] - a[0]);
  const out = [];
  for (const [s, t] of order) {
    if (out.length >= n) break;
    if (s < 0.25) break;
    if (out.some((x) => Math.abs(x.pico - t) < alvo)) continue;
    let inicio = Math.max(0, t - alvo * 0.6);
    let fim = Math.min(dur, t + alvo * 0.4);
    if (fim - inicio < min) fim = Math.min(dur, inicio + min);
    if (fim - inicio > max) fim = inicio + max;
    const picos = [];
    for (let j = Math.ceil(inicio); j < Math.floor(fim); j++) if ((nS[j] > 0.55 || score[j] > s * 0.8) && !picos.some((p) => Math.abs(p - j) < 3)) picos.push(j);
    out.push({ pico: t, inicio, fim, nota: s, sinais: { grito: nS[t], acao: nC[t] }, picos });
  }
  return out;
}

const PALAVRAS = [
  "meu deus", "nossa", "caramba", "caraca", "caralho", "porra", "não acredito", "nao acredito", "olha isso", "que isso",
  "socorro", "corre", "mano", "véi", "mds", "puts", "eita", "uau", "irmão", "não não", "foge", "morri", "acabou",
  "absurdo", "insano", "surreal", "rapaz", "misericórdia", "kkk", "haha", "risos",
  "oh my god", "no way", "what the", "holy", "insane", "let's go", "bro", "dude", "wow",
];

/** Etapa 2: com a fala transcrita, soma o sinal de REAÇÃO/RISADA e ajusta início/fim às frases */
export function refinar(c, words) {
  let kw = 0;
  let riso = 0;
  const perto = words.filter((w) => Math.abs(w.start - (c.pico - c.inicio)) < 6);
  for (let i = 0; i < words.length; i++) {
    const ctx = ((words[i - 1]?.text ?? "") + " " + words[i].text + " " + (words[i + 1]?.text ?? "")).toLowerCase();
    const peso = perto.includes(words[i]) ? 1.5 : 0.5;
    for (const k of PALAVRAS) if (ctx.includes(k)) kw += peso;
    if (/k{3,}|haha|risos|laugh/i.test(words[i].text)) riso += peso;
    if (/!/.test(words[i].text)) kw += 0.3 * peso;
  }
  const reacao = Math.min(1, kw / 6);
  const risada = Math.min(1, riso / 3);
  const sinais = { ...c.sinais, reacao, risada };
  const tipo = Object.entries({ GRITO: sinais.grito, REAÇÃO: reacao, AÇÃO: sinais.acao, RISADA: risada }).sort((a, b) => b[1] - a[1])[0][0];
  // encaixa começo/fim em pausas da fala (>= 0.35 s)
  const dur = c.fim - c.inicio;
  const gaps = [];
  for (let i = 1; i < words.length; i++) if (words[i].start - words[i - 1].end >= 0.35) gaps.push([words[i - 1].end, words[i].start]);
  const near = (x, side) => {
    const g = gaps.filter((p) => Math.abs((side === "s" ? p[1] : p[0]) - x) <= 3);
    if (!g.length) return x;
    g.sort((a, b) => Math.abs((side === "s" ? a[1] : a[0]) - x) - Math.abs((side === "s" ? b[1] : b[0]) - x));
    return side === "s" ? Math.max(0, g[0][1] - 0.15) : g[0][0] + 0.35;
  };
  const ds = near(0, "s");
  const de = near(dur, "e");
  return {
    ...c,
    tipo,
    sinais,
    nota: c.nota + 0.9 * reacao + 0.7 * risada,
    inicio: c.inicio + ds,
    fim: c.inicio + Math.max(ds + 8, Math.min(de, dur + 2)),
    words: words.map((w) => ({ ...w, start: +(w.start - ds).toFixed(2), end: +(w.end - ds).toFixed(2) })).filter((w) => w.end > 0),
    trecho: words.map((w) => w.text).join(" "),
  };
}
