// Transcreve um áudio/vídeo de voz e grava as palavras com tempo no video.json do projeto.
// Uso (dentro da pasta do projeto):
//   node <skill>/scripts/transcrever.mjs public/voz.mp3 [--modelo=small] [--idioma=pt]
// Na 1ª vez baixa o whisper.cpp e o modelo (o "small" tem ~460 MB) para .whisper/
import fs from "node:fs";
import path from "node:path";
import { arg, toWav, transcribeWords, WHISPER_DIR } from "./lib/comum.mjs";

const input = process.argv[2];
if (!input || input.startsWith("--")) {
  console.error("Uso: node transcrever.mjs <arquivo de áudio/vídeo> [--modelo=small] [--idioma=pt]");
  process.exit(1);
}
fs.mkdirSync(WHISPER_DIR, { recursive: true });
const wav = toWav(input, path.join(WHISPER_DIR, "entrada.wav"));
const words = await transcribeWords(wav, { model: arg("modelo", "small"), language: arg("idioma", "pt") });

const specPath = path.resolve("video.json");
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
spec.words = words;
fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
const dur = words.length ? words[words.length - 1].end : 0;
console.log(`${words.length} palavras, ${dur.toFixed(1)} s de fala. Gravado em video.json -> "words".`);
console.log(`Ajuste as durações das cenas para somar pelo menos ${Math.ceil(dur + 1)} s.`);
