// Funções compartilhadas pelos scripts (rodam de dentro da pasta do projeto).
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

export const WHISPER_VERSION = "1.5.5";
export const WHISPER_DIR = path.resolve(".whisper");

export const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`) || x === `--${k}`);
  if (!a) return d;
  return a.includes("=") ? a.split("=").slice(1).join("=") : true;
};

export const ffprobe = (file) => {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height:format=duration",
    "-of", "json", file,
  ]).toString();
  const j = JSON.parse(out);
  return {
    duration: Number(j.format?.duration ?? 0),
    width: j.streams?.[0]?.width ?? 1920,
    height: j.streams?.[0]?.height ?? 1080,
  };
};

export const VIDEO_EXT = /\.(mp4|mov|mkv|webm|m4v|avi|ts|flv)$/i;

export const listVideos = (dir) =>
  fs
    .readdirSync(dir)
    .filter((f) => VIDEO_EXT.test(f))
    .sort()
    .map((f) => path.resolve(dir, f));

/** Converte para WAV 16 kHz mono (formato exigido pelo whisper.cpp) */
export const toWav = (input, out, start, end) => {
  const args = ["-v", "error", "-y"];
  if (start != null) args.push("-ss", String(start));
  if (end != null) args.push("-to", String(end));
  const abs = path.resolve(out); // o whisper roda com outra pasta atual: caminho absoluto
  args.push("-i", input, "-vn", "-ar", "16000", "-ac", "1", abs);
  execFileSync("ffmpeg", args);
  return abs;
};

let whisperReady = new Set();
export const transcribeWords = async (wavPath, { model = "small", language = "pt" } = {}) => {
  const require = createRequire(path.resolve("package.json"));
  const { installWhisperCpp, downloadWhisperModel, transcribe, toCaptions } = require("@remotion/install-whisper-cpp");
  if (!whisperReady.has(model)) {
    await installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSION, printOutput: false });
    await downloadWhisperModel({ model, folder: WHISPER_DIR, printOutput: false });
    whisperReady.add(model);
  }
  const out = await transcribe({
    inputPath: wavPath,
    whisperPath: WHISPER_DIR,
    whisperCppVersion: WHISPER_VERSION,
    model,
    tokenLevelTimestamps: true,
    language,
    printOutput: false,
  });
  const { captions } = toCaptions({ whisperCppOutput: out });
  // o whisper devolve pedaços de palavra ("cl", "ipp", "ar"): junta o que não começa com espaço
  const words = [];
  for (const c of captions) {
    const raw = c.text;
    if (!raw.trim() || /^\s*\[_?[A-Z_]+_?\]\s*$/.test(raw)) continue; // [_BEG_] etc.
    const start = +(c.startMs / 1000).toFixed(2);
    const end = +(c.endMs / 1000).toFixed(2);
    const prev = words[words.length - 1];
    if (prev && !/^\s/.test(raw)) {
      prev.text += raw.trim();
      prev.end = end;
    } else {
      words.push({ text: raw.trim(), start, end });
    }
  }
  return words;
};

/** Volume (dB RMS) a cada `step` segundos, lendo o áudio em streaming (funciona com lives de horas) */
export const loudness = (file, step = 0.25) =>
  new Promise((resolve, reject) => {
    const rate = 8000;
    const per = Math.round(rate * step);
    const p = spawn("ffmpeg", ["-v", "error", "-i", file, "-vn", "-ac", "1", "-ar", String(rate), "-f", "s16le", "-"]);
    const out = [];
    let acc = 0;
    let n = 0;
    let carry = Buffer.alloc(0);
    p.stdout.on("data", (chunk) => {
      const buf = carry.length ? Buffer.concat([carry, chunk]) : chunk;
      const usable = buf.length - (buf.length % 2);
      for (let i = 0; i < usable; i += 2) {
        const v = buf.readInt16LE(i) / 32768;
        acc += v * v;
        if (++n === per) {
          out.push(10 * Math.log10(acc / n + 1e-10));
          acc = 0;
          n = 0;
        }
      }
      carry = buf.subarray(usable);
    });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error("ffmpeg falhou ao ler áudio de " + file))));
  });

/** Tempos (s) de cortes de cena / mudanças bruscas de imagem */
export const sceneCuts = (file, threshold = 0.3) =>
  new Promise((resolve) => {
    const p = spawn("ffmpeg", [
      "-v", "info", "-i", file, "-an",
      "-vf", `fps=4,scale=160:-2,select='gt(scene,${threshold})',showinfo`,
      "-f", "null", "-",
    ]);
    const times = [];
    let buf = "";
    p.stderr.on("data", (d) => {
      buf += d.toString();
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const l of lines) {
        const m = l.match(/pts_time:([\d.]+)/);
        if (m) times.push(Number(m[1]));
      }
    });
    p.on("close", () => resolve(times));
  });

export const fmt = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return (h ? `${h}:${String(m).padStart(2, "0")}` : `${m}`) + `:${String(ss).padStart(2, "0")}`;
};
