// MODO CORTES, passo 1: encontra os melhores momentos numa pasta de vídeos (gameplay, lives, reacts).
//
// Uso (dentro da pasta do projeto criada por novo-projeto.sh):
//   node <skill>/scripts/analisar.mjs <pasta-com-videos> [--cortes=8] [--duracao=30] [--min=15] [--max=60]
//                                     [--modelo=base] [--idioma=pt] [--sem-transcricao] [--sem-cenas]
//
// Combina 4 sinais para dar nota a cada segundo:
//   - GRITO:   pico de volume em relação aos 30 s anteriores
//   - REAÇÃO:  palavras de reação na transcrição ("meu deus", "não acredito", "kkkk"...)
//   - AÇÃO:    muitos cortes/mudanças bruscas de imagem (explosão, perseguição, batida)
//   - FALA:    fala acelerada (empolgação)
// Gera:
//   analise.json                 candidatos ordenados por nota, com trecho falado
//   .analise/thumb-XX.jpg        1 frame do pico de cada candidato (pra você olhar e escrever o título)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { arg, fmt, listVideos, loudness, ffprobe, sceneCuts, toWav, transcribeWords } from "./lib/comum.mjs";

const dir = process.argv[2];
if (!dir || dir.startsWith("--") || !fs.existsSync(dir)) {
  console.error("Uso: node analisar.mjs <pasta-com-videos> [--cortes=8] [--duracao=30]");
  process.exit(1);
}
const N = Number(arg("cortes", 8));
const ALVO = Number(arg("duracao", 30));
const MIN = Number(arg("min", 15));
const MAX = Number(arg("max", 60));
const MODELO = arg("modelo", "base");
const IDIOMA = arg("idioma", "pt");
const TRANSCREVER = !arg("sem-transcricao", false);
const CENAS = !arg("sem-cenas", false);

const KEYWORDS = [
  // pt-BR
  "meu deus", "nossa", "caramba", "caraca", "caralho", "porra", "não acredito", "nao acredito", "olha isso",
  "que isso", "socorro", "corre", "mano", "véi", "vei", "mds", "puts", "eita", "aaa", "ahh", "uau", "irmão",
  "não não", "nao nao", "para", "foge", "morri", "acabou", "absurdo", "insano", "surreal", "rapaz", "misericórdia",
  "kkk", "haha", "risos", "gritos", "grito", "explosão",
  // en
  "oh my god", "no way", "what the", "holy", "insane", "let's go", "lets go", "run", "bro", "dude", "wow",
  "laughter", "laughs", "screams", "screaming",
];

const files = listVideos(dir);
if (!files.length) {
  console.error("Nenhum vídeo encontrado em " + dir);
  process.exit(1);
}
fs.mkdirSync(".analise", { recursive: true });
fs.mkdirSync(".whisper", { recursive: true });

const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const norm = (arr) => {
  const sorted = [...arr].sort((a, b) => a - b);
  const p = sorted[Math.floor(sorted.length * 0.98)] || 1;
  return arr.map((v) => Math.min(1, v / (p || 1)));
};

const candidatos = [];
const videos = [];

for (const file of files) {
  const info = ffprobe(file);
  const base = path.basename(file);
  const cacheKey = base.replace(/[^\w.-]/g, "_");
  console.log(`\n▶ ${base} (${fmt(info.duration)})`);
  videos.push({ file, ...info });
  const T = Math.floor(info.duration);
  if (T < MIN) {
    console.log("  curto demais, pulando");
    continue;
  }

  // 1) volume
  process.stdout.write("  volume... ");
  const loud = await loudness(file, 0.25);
  const perSec = Array.from({ length: T }, (_, t) => Math.max(...loud.slice(t * 4, t * 4 + 4), -90));
  const spike = perSec.map((v, t) => Math.max(0, v - median(perSec.slice(Math.max(0, t - 30), Math.max(1, t - 2)))));
  console.log("ok");

  // 2) cortes de cena
  let cuts = [];
  if (CENAS) {
    process.stdout.write("  imagem... ");
    cuts = await sceneCuts(file);
    console.log(`${cuts.length} mudanças bruscas`);
  }
  const scene = Array.from({ length: T }, (_, t) => cuts.filter((c) => Math.abs(c - t) <= 3).length);

  // 3) transcrição (cache em .analise/)
  let words = [];
  if (TRANSCREVER) {
    const cache = `.analise/${cacheKey}.${MODELO}.words.json`;
    if (fs.existsSync(cache)) words = JSON.parse(fs.readFileSync(cache, "utf8"));
    else {
      process.stdout.write(`  transcrevendo (whisper ${MODELO})... `);
      const wav = toWav(file, `.whisper/${cacheKey}.wav`);
      words = await transcribeWords(wav, { model: MODELO, language: IDIOMA });
      fs.writeFileSync(cache, JSON.stringify(words));
      fs.rmSync(wav);
      console.log(`${words.length} palavras`);
    }
  }
  const kw = new Array(T).fill(0);
  const rate = new Array(T).fill(0);
  const laugh = new Array(T).fill(0);
  words.forEach((w, i) => {
    const t = Math.min(T - 1, Math.floor(w.start));
    rate[t] += 1;
    const ctx = (words[i - 1]?.text ?? "") + " " + w.text + " " + (words[i + 1]?.text ?? "");
    const l = ctx.toLowerCase();
    for (const k of KEYWORDS) if (l.includes(k)) kw[t] += 1;
    if (/k{3,}|haha|risos|laugh|\[ ?riso/i.test(w.text)) laugh[t] += 1;
    if (/!/.test(w.text)) kw[t] += 0.5;
  });
  const smooth = (a, r) => a.map((_, t) => a.slice(Math.max(0, t - r), t + r + 1).reduce((x, y) => x + y, 0));
  const kwS = smooth(kw, 2);
  const rateS = smooth(rate, 2);
  const laughS = smooth(laugh, 3);

  const nSpike = norm(spike);
  const nScene = norm(scene);
  const nKw = norm(kwS);
  const nRate = norm(rateS);
  const nLaugh = norm(laughS);
  const score = Array.from({ length: T }, (_, t) =>
    1.0 * nSpike[t] + 0.6 * nScene[t] + 0.9 * nKw[t] + 0.3 * nRate[t] + 0.7 * nLaugh[t],
  );

  // 4) escolhe picos sem sobreposição
  const order = score.map((s, t) => [s, t]).sort((a, b) => b[0] - a[0]);
  const taken = [];
  for (const [s, t] of order) {
    if (taken.length >= N * 2) break;
    if (s < 0.4) break;
    if (taken.some((x) => Math.abs(x.peak - t) < ALVO)) continue;

    // janela: preparação antes do pico, payoff + reação depois
    let start = Math.max(0, t - ALVO * 0.6);
    let end = Math.min(info.duration, t + ALVO * 0.4);
    // encaixa no começo/fim de frase (pausa >= 0.35 s entre palavras)
    const gaps = [];
    for (let i = 1; i < words.length; i++) if (words[i].start - words[i - 1].end >= 0.35) gaps.push([words[i - 1].end, words[i].start]);
    const near = (x, side) => {
      const c = gaps.filter((g) => Math.abs((side === "start" ? g[1] : g[0]) - x) <= 4);
      if (!c.length) return x;
      c.sort((a, b) => Math.abs((side === "start" ? a[1] : a[0]) - x) - Math.abs((side === "start" ? b[1] : b[0]) - x));
      return side === "start" ? Math.max(0, c[0][1] - 0.15) : Math.min(info.duration, c[0][0] + 0.35);
    };
    start = near(start, "start");
    end = near(end, "end");
    if (end - start < MIN) end = Math.min(info.duration, start + MIN);
    if (end - start > MAX) end = start + MAX;

    const parts = { GRITO: nSpike[t], "REAÇÃO": nKw[t], "AÇÃO": nScene[t], RISADA: nLaugh[t] };
    const tipo = Object.entries(parts).sort((a, b) => b[1] - a[1])[0][0];
    // picos secundários dentro do corte (para zoom/efeito)
    const picos = [];
    for (let k = Math.ceil(start); k < Math.floor(end); k++) {
      if (nSpike[k] > 0.55 || score[k] > s * 0.8) if (!picos.some((p) => Math.abs(p - k) < 3)) picos.push(k);
    }
    const trecho = words
      .filter((w) => w.start >= start && w.end <= end)
      .map((w) => w.text)
      .join(" ");
    taken.push({ peak: t, s, start, end, tipo, picos, trecho, parts });
  }

  for (const c of taken) {
    candidatos.push({
      arquivo: file,
      inicio: +c.start.toFixed(2),
      fim: +c.end.toFixed(2),
      pico: c.peak,
      picos: c.picos.map((p) => +(p - c.start).toFixed(2)),
      nota: +c.s.toFixed(3),
      tipo: c.tipo,
      sinais: Object.fromEntries(Object.entries(c.parts).map(([k, v]) => [k, +v.toFixed(2)])),
      trecho: c.trecho.slice(0, 600),
    });
  }
}

candidatos.sort((a, b) => b.nota - a.nota);
const final = candidatos.slice(0, N * 2).map((c, i) => ({ id: i + 1, ...c }));

// thumbnails do pico
for (const c of final) {
  const thumb = `.analise/thumb-${String(c.id).padStart(2, "0")}.jpg`;
  try {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(c.pico), "-i", c.arquivo, "-frames:v", "1", "-vf", "scale=640:-2", thumb]);
    c.thumb = thumb;
  } catch {}
}

fs.writeFileSync("analise.json", JSON.stringify({ criado: new Date().toISOString(), videos, candidatos: final }, null, 2));

console.log(`\n${final.length} candidatos (os ${N} melhores primeiro):\n`);
console.log("id | nota | tipo    | arquivo                | trecho           | fala");
for (const c of final) {
  console.log(
    `${String(c.id).padStart(2)} | ${c.nota.toFixed(2)} | ${c.tipo.padEnd(7)} | ${path.basename(c.arquivo).slice(0, 22).padEnd(22)} | ${fmt(c.inicio)}–${fmt(c.fim)} (${Math.round(c.fim - c.inicio)}s) | ${c.trecho.slice(0, 70)}`,
  );
}
console.log("\nResultado em analise.json e thumbnails em .analise/");
