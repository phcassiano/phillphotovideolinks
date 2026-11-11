// Transcrição com Whisper rodando no próprio navegador (WebGPU quando existe, senão WebAssembly).
// O modelo é baixado uma vez do Hugging Face e fica em cache no navegador.
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

env.allowLocalModels = false;
let asr = null;
let atual = null;

async function carregar(model) {
  if (asr && atual === model) return asr;
  const progress_callback = (p) => {
    if (p.status === "progress") self.postMessage({ type: "download", file: p.file, progress: p.progress ?? 0 });
  };
  const temGpu = !!self.navigator?.gpu && !!(await self.navigator.gpu.requestAdapter().catch(() => null));
  try {
    asr = await pipeline("automatic-speech-recognition", model, temGpu
      ? { device: "webgpu", dtype: { encoder_model: "fp32", decoder_model_merged: "q4" }, progress_callback }
      : { device: "wasm", dtype: "q8", progress_callback });
  } catch (e) {
    // WebGPU falhou: tenta WebAssembly
    asr = await pipeline("automatic-speech-recognition", model, { device: "wasm", dtype: "q8", progress_callback });
  }
  atual = model;
  self.postMessage({ type: "ready", device: temGpu ? "webgpu" : "wasm" });
  return asr;
}

/**
 * O Whisper às vezes "alucina" em trechos de barulho (grito, música, explosão) e repete a mesma frase.
 * Remove repetições seguidas de 3+ palavras e trechos com fala impossível de rápida.
 */
function limparAlucinacao(ws, dur) {
  const norm = (w) => w.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  let out = [];
  for (let i = 0; i < ws.length; ) {
    let pulou = false;
    for (let k = 8; k >= 3; k--) {
      if (out.length < k || i + k > ws.length) continue;
      let igual = true;
      for (let j = 0; j < k; j++) if (norm(out[out.length - k + j]) !== norm(ws[i + j])) { igual = false; break; }
      if (igual) { i += k; pulou = true; break; }
    }
    if (!pulou) out.push(ws[i++]);
  }
  // fora do áudio = lixo
  out = out.filter((w) => w.start <= dur + 0.5);
  // palavras "empilhadas" no mesmo instante: espalha até a próxima palavra (~0,32 s cada)
  for (let i = 0; i < out.length; ) {
    let j = i;
    while (j + 1 < out.length && Math.abs(out[j + 1].start - out[i].start) < 0.02) j++;
    if (j > i) {
      const n = j - i + 1;
      const ini = out[i].start;
      const lim = out[j + 1]?.start ?? Math.min(dur, ini + n * 0.32);
      const passo = Math.max(0.12, Math.min(0.45, (lim - ini) / n));
      for (let k = 0; k < n; k++) {
        out[i + k] = { ...out[i + k], start: +(ini + k * passo).toFixed(2), end: +(ini + (k + 1) * passo).toFixed(2) };
      }
    }
    i = j + 1;
  }
  const ok = out.filter((w) => out.filter((x) => Math.abs(x.start - w.start) < 1).length <= 14);
  return ok.length >= out.length * 0.5 ? ok : out;
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "transcrever") {
      const p = await carregar(data.model);
      const out = await p(data.audio, {
        language: data.lang || "portuguese",
        task: "transcribe",
        return_timestamps: "word",
        chunk_length_s: 30,
        stride_length_s: 5,
      });
      const brutas = (out.chunks ?? [])
        .map((c) => ({ text: String(c.text).trim().replace(/^[-–—]+\s*/, ""), start: Number(c.timestamp?.[0] ?? 0), end: Number(c.timestamp?.[1] ?? c.timestamp?.[0] ?? 0) }))
        .filter((w) => w.text && Number.isFinite(w.start));
      const words = limparAlucinacao(brutas, data.audio.length / 16000);
      self.postMessage({ type: "result", id: data.id, words });
    }
  } catch (e) {
    self.postMessage({ type: "error", id: data.id, message: String(e?.message ?? e) });
  }
};
