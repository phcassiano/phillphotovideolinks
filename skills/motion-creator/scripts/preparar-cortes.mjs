// MODO CORTES, passo 2: recorta os momentos aprovados, transcreve cada um com precisão
// e gera os arquivos de props que o Remotion usa para renderizar.
//
// Uso (dentro da pasta do projeto):
//   node <skill>/scripts/preparar-cortes.mjs            (lê analise.json + cortes.json)
//
// cortes.json (escrito pela skill depois que o usuário aprova):
// {
//   "tema": "neon-city", "handle": "@seucanal", "layout": "blur",
//   "facecam": { "x": 0.70, "y": 0.62, "w": 0.30, "h": 0.38 },   // só para layout split
//   "teaser": true, "cta": { "verb": "Comenta", "word": "CORTES" },
//   "musica": null, "musicaVolume": 0.12, "modeloLegenda": "small", "idioma": "pt",
//   "partes": false,                                              // mostra "PARTE 1/5"
//   "compilado": { "titulo": "Melhores momentos" },                // opcional: gera o 16:9 pro YouTube
//   "cortes": [ { "id": 3, "titulo": "Ele *não acreditou* no final", "emoji": "😱" } ]
// }
// Cada item de "cortes" pode sobrescrever: inicio, fim, layout, facecam, jogo, tag, cta, teaser, picos.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ffprobe, toWav, transcribeWords } from "./lib/comum.mjs";

const analise = JSON.parse(fs.readFileSync("analise.json", "utf8"));
const cfg = JSON.parse(fs.readFileSync("cortes.json", "utf8"));
const byId = new Map(analise.candidatos.map((c) => [c.id, c]));

fs.mkdirSync("public/cortes", { recursive: true });
fs.mkdirSync("cortes", { recursive: true });
fs.mkdirSync(".whisper", { recursive: true });

const total = cfg.cortes.length;
const lista = [];

for (const [i, item] of cfg.cortes.entries()) {
  const c = byId.get(item.id);
  if (!c) {
    console.error(`Corte id ${item.id} não existe em analise.json, pulando.`);
    continue;
  }
  const nn = String(i + 1).padStart(2, "0");
  const inicio = item.inicio ?? c.inicio;
  const fim = item.fim ?? c.fim;
  const out = `public/cortes/corte-${nn}.mp4`;
  console.log(`✂  corte ${nn}: ${path.basename(c.arquivo)} ${inicio}s → ${fim}s`);

  // recorte preciso (re-encode), máximo 1080p, 30 fps, som normalizado
  execFileSync("ffmpeg", [
    "-v", "error", "-y",
    "-ss", String(inicio), "-to", String(fim), "-i", c.arquivo,
    "-vf", "scale='min(1920,iw)':-2,fps=30",
    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    "-movflags", "+faststart", out,
  ]);
  const info = ffprobe(out);

  // legenda precisa: transcreve só o trecho com o modelo melhor
  const wav = toWav(out, `.whisper/corte-${nn}.wav`);
  const words = await transcribeWords(wav, { model: cfg.modeloLegenda ?? "small", language: cfg.idioma ?? "pt" });
  fs.rmSync(wav);

  const props = {
    src: `cortes/corte-${nn}.mp4`,
    duration: +info.duration.toFixed(2),
    srcW: info.width,
    srcH: info.height,
    words,
    titulo: item.titulo ?? "",
    tag: item.tag ?? c.tipo,
    emoji: item.emoji ?? { GRITO: "😱", "REAÇÃO": "🤯", "AÇÃO": "💥", RISADA: "😂" }[c.tipo] ?? "🔥",
    picos: item.picos ?? (c.picos?.length ? c.picos : [+(c.pico - inicio).toFixed(2)]),
    layout: item.layout ?? cfg.layout ?? "blur",
    jogo: item.jogo ?? cfg.jogo,
    facecam: item.facecam ?? cfg.facecam,
    teaser: item.teaser ?? cfg.teaser ?? true,
    cta: item.cta === undefined ? cfg.cta ?? null : item.cta,
    handle: cfg.handle,
    theme: cfg.tema ?? "neon-city",
    music: cfg.musica ?? null,
    musicVolume: cfg.musicaVolume ?? 0.12,
    mascot: cfg.mascote,
    parte: cfg.partes ? { n: i + 1, total } : null,
  };
  // pico principal primeiro (é ele que abre o teaser)
  const principal = +(c.pico - inicio).toFixed(2);
  props.picos = [principal, ...props.picos.filter((p) => Math.abs(p - principal) > 1.5)].filter((p) => p >= 1 && p < props.duration - 0.5)
    .sort((x, y) => (x === principal ? -1 : y === principal ? 1 : x - y));
  const file = `cortes/corte-${nn}.props.json`;
  fs.writeFileSync(file, JSON.stringify(props, null, 2));
  lista.push({ file, out: `out/cortes/corte-${nn}.mp4`, titulo: props.titulo, duracao: props.duration });
  console.log(`   ${words.length} palavras na legenda → ${file}`);
}

if (cfg.compilado) {
  const itens = lista.map((l) => {
    const p = JSON.parse(fs.readFileSync(l.file, "utf8"));
    return { src: p.src, duration: p.duration, srcW: p.srcW, srcH: p.srcH, titulo: p.titulo, words: p.words };
  });
  // do menos forte pro mais forte (contagem regressiva termina no #1)
  itens.reverse();
  fs.writeFileSync(
    "cortes/compilado.props.json",
    JSON.stringify({ titulo: cfg.compilado.titulo ?? "Melhores momentos", theme: cfg.tema ?? "neon-city", handle: cfg.handle, itens }, null, 2),
  );
  console.log("🎬 compilado → cortes/compilado.props.json");
}

fs.writeFileSync("cortes/lista.json", JSON.stringify(lista, null, 2));
console.log(`\n${lista.length} cortes prontos para render. Rode: bash <skill>/scripts/render.sh . --cortes`);
