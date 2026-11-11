import { db } from "./db.js";
import { duracao, volume, mudancasDeCena, candidatos, refinar, audioTrecho, thumbnail } from "./analise.js";
import { gravar, previa, TEMAS, introS, formatoSaida } from "./render.js";
import { montarAgenda, ics, csv, REDES } from "./agenda.js";
import { abrirEditor } from "./editor.js";
import { canais as pzCanais, redeDoCanal, agendar as pzAgendar } from "./publicar.js";
import { resolver, baixarHls, baixarArquivo, escolherVariantes, paraSeg, ehYoutube, ajudanteOnline, baixarPeloAjudante } from "./link.js";

/* ------------------------- estado ------------------------- */

const CFG_PADRAO = {
  n: 6, alvo: 30, idioma: "portuguese", modelo: "onnx-community/whisper-base_timestamped", cenas: true,
  handle: "", pagina: "", hashtags: "#gta6 #gtavi #gta #cortes #gameplay",
  tema: "neon", layout: "blur", facecam: null,
  templates: ["padrao", "noticia", "faixa", "minimal"], intros: ["teaser", "letreiro"],
  ctas: [{ verb: "Comenta", word: "CORTES" }, { verb: "Segue pra", word: "PARTE 2" }], porCorte: 3,
  inicio: "", horarios: "12:00, 18:30, 21:00", rodadas: 1, lembrete: 10, redes: ["instagram", "tiktok", "youtube"],
};
const S = { arquivos: [], cfg: { ...CFG_PADRAO }, momentos: [], renders: [], postados: {}, links: [], enviados: {} };
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (s) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return (h ? `${h}:${String(m).padStart(2, "0")}` : m) + ":" + String(ss).padStart(2, "0");
};
const chaveArq = (f) => `${f.name}|${f.size}`;
const salvar = () => db.put("kv", { cfg: S.cfg, momentos: S.momentos, postados: S.postados, links: S.links, enviados: S.enviados }, "estado");

function toast(msg, erro = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast on" + (erro ? " erro" : "");
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = "toast"), erro ? 4000 : 1600);
}

/* ------------------------- navegação ------------------------- */

function ir(passo) {
  $$(".passo").forEach((s) => s.classList.toggle("ativo", s.id === passo));
  $$("#passos button").forEach((b) => b.classList.toggle("ativo", b.dataset.passo === passo));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (passo === "momentos") renderMomentos();
  if (passo === "estilo") { renderEstilo(); atualizarPrevia(); }
  if (passo === "gerar") renderGerar();
  if (passo === "agenda") renderAgenda();
}
$("#passos").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-passo]");
  if (b) ir(b.dataset.passo);
});
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-ir]");
  if (b) ir(b.dataset.ir);
});
const marcarFeito = () => {
  const feito = { videos: S.momentos.length > 0, momentos: S.momentos.some((m) => m.aprovado), estilo: S.renders.length > 0, gerar: S.renders.length > 0, agenda: false };
  $$("#passos button").forEach((b) => b.classList.toggle("feito", !!feito[b.dataset.passo]));
};

/* ------------------------- 1. arquivos ------------------------- */

const drop = $("#drop");
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("sobre"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("sobre"); }));
drop.addEventListener("drop", (e) => addArquivos([...e.dataTransfer.files]));
$("#inputArquivos").addEventListener("change", (e) => addArquivos([...e.target.files]));

async function addArquivos(files) {
  for (const f of files.filter((f) => f.type.startsWith("video/") || /\.(mp4|mov|m4v|mkv|webm)$/i.test(f.name))) {
    if (S.arquivos.some((a) => a.id === chaveArq(f))) continue;
    const a = { id: chaveArq(f), file: f, nome: f.name, status: "lendo...", prog: 0 };
    S.arquivos.push(a);
    renderArquivos();
    try {
      Object.assign(a, await duracao(f));
      a.status = `${fmt(a.duracao)} · ${a.w}×${a.h}`;
    } catch (e) {
      a.status = "não consegui abrir este vídeo";
      a.erro = true;
    }
    renderArquivos();
  }
}

function renderArquivos() {
  $("#listaArquivos").innerHTML = S.arquivos
    .map((a) => `<div class="arq"><b title="${esc(a.nome)}">${esc(a.nome)}</b><button class="x" data-rm="${esc(a.id)}" aria-label="Remover">×</button><small>${esc(a.status)}</small><small></small>${a.prog > 0 && a.prog < 1 ? `<div class="barra"><i style="width:${(a.prog * 100).toFixed(1)}%"></i></div>` : ""}</div>`)
    .join("");
  $("#btnAnalisar").disabled = !S.arquivos.some((a) => !a.erro && a.duracao);
  // momentos salvos cujos vídeos ainda não foram re-adicionados
  const faltam = [...new Set(S.momentos.map((m) => m.arquivoId))].filter((id) => !S.arquivos.some((a) => a.id === id));
  if (faltam.length && S.momentos.length) {
    const arqs = faltam.filter((f) => !f.startsWith("link|"));
    const links = faltam.map((f) => S.links.find((l) => l.id === f)).filter(Boolean);
    $("#statusAnalise").innerHTML = `<span>Você tem ${S.momentos.length} momentos salvos. Para gerar vídeos deles, ${arqs.length ? `adicione de novo: <b>${arqs.map((f) => esc(f.split("|")[0])).join(", ")}</b>` : ""}${links.map((l) => ` <button class="btn ghost peq" data-rebaixar="${esc(l.id)}">Baixar de novo: ${esc(l.titulo || l.url)}</button>`).join("")}</span>`;
  }
}
$("#listaArquivos").addEventListener("click", (e) => {
  const b = e.target.closest("[data-rm]");
  if (!b) return;
  S.arquivos = S.arquivos.filter((a) => a.id !== b.dataset.rm);
  renderArquivos();
});


/* ------------------------- 1b. link ------------------------- */

$("#btnLink").addEventListener("click", () => adicionarLink());
$("#inputLink").addEventListener("keydown", (e) => { if (e.key === "Enter") adicionarLink(); });

async function adicionarLink(salvo = null) {
  const url = salvo?.url ?? $("#inputLink").value.trim();
  if (!/^https?:\/\//i.test(url)) return toast("Cole um link começando com https://", true);
  const de = salvo ? salvo.de : paraSeg($("#linkDe").value);
  const ate = salvo ? salvo.ate : paraSeg($("#linkAte").value);
  const qualidade = salvo?.qualidade ?? +$("#linkQualidade").value;
  if (de != null && ate != null && ate <= de) return toast("O fim precisa ser depois do início.", true);
  const id = `link|${url}|${de ?? ""}|${ate ?? ""}`;
  if (S.arquivos.some((a) => a.id === id)) return toast("Esse link já está na lista.");
  if (ehYoutube(url) && !(await ajudanteOnline())) {
    $("#ajudanteBox").hidden = false;
    $("#ajudanteBox").scrollIntoView({ behavior: "smooth", block: "center" });
    $("#ajudanteStatus").textContent = "Não encontrei o Ajudante aberto neste computador.";
    return;
  }
  const a = { id, nome: url, status: "abrindo o link...", prog: 0.001 };
  S.arquivos.push(a);
  renderArquivos();
  $("#btnLink").disabled = true;
  try {
    if (ehYoutube(url)) {
      $("#ajudanteBox").hidden = true;
      a.status = "o Ajudante está baixando no seu computador...";
      renderArquivos();
      const r = await baixarPeloAjudante(url, { qualidade, de, ate, onProgress: (p, txt) => { a.prog = Math.max(0.001, p); a.status = txt; renderArquivosLeve(); } });
      a.nome = r.titulo;
      a.file = r.file;
      a.link = null;
      Object.assign(a, await duracao(a.file));
      a.prog = 1;
      a.status = `${fmt(a.duracao)} · YouTube (baixado pelo Ajudante, ${a.h}p)`;
      S.links = S.links.filter((l) => l.id !== id).concat({ id, url, de, ate, qualidade, titulo: a.nome });
      salvar();
      if (!salvo) $("#inputLink").value = "";
      return;
    }
    const res = await resolver(url);
    a.nome = res.titulo || url;
    const { analise, corte } = escolherVariantes(res, qualidade, ate != null ? ate - (de ?? 0) : null);
    a.status = `baixando ${analise.altura ? analise.altura + "p" : "o vídeo"} para analisar...`;
    renderArquivos();
    const onProgress = (p) => { a.prog = Math.max(0.001, p); renderArquivosLeve(); };
    const r = analise.hls
      ? await baixarHls(analise.url, { de, ate, nome: a.nome.slice(0, 60), onProgress })
      : await baixarArquivo(analise.url, { nome: a.nome.slice(0, 60), onProgress, cab: analise.cabecalhos });
    a.file = r.file;
    a.link = { url, de, ate, qualidade, corte: corte.id !== analise.id ? corte : null, inicioAnalise: r.inicio };
    Object.assign(a, await duracao(a.file));
    a.prog = 1;
    a.status = `${fmt(a.duracao)} · ${res.origem || "link"} ${analise.id !== corte.id && analise.altura ? `(análise em ${analise.altura}p, cortes em ${corte.altura}p)` : a.h ? `(${a.w}×${a.h})` : ""}`;
    S.links = S.links.filter((l) => l.id !== id).concat({ id, url, de, ate, qualidade, titulo: a.nome });
    salvar();
    if (!salvo) $("#inputLink").value = "";
  } catch (e) {
    console.error(e);
    a.erro = true;
    a.prog = 0;
    a.status = e.message;
    toast(e.message, true);
  } finally {
    $("#btnLink").disabled = false;
    renderArquivos();
  }
}
$("#btnTestarAjudante").addEventListener("click", async () => {
  const st = $("#ajudanteStatus");
  st.textContent = "Procurando o Ajudante...";
  const ok = await ajudanteOnline();
  st.textContent = ok ? `Ajudante ${ok.versao} encontrado! Clique em Adicionar.` : "Ainda não encontrei. Confira se a janela do Ajudante está aberta e escrito \"Pronto!\".";
  if (ok && $("#inputLink").value.trim()) adicionarLink();
});
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-rebaixar]");
  if (!b) return;
  const l = S.links.find((x) => x.id === b.dataset.rebaixar);
  if (l) { b.remove(); adicionarLink(l); }
});

/** arquivo usado para gravar um corte: o original, ou (link) só o trecho baixado em alta qualidade */
const trechosHQ = new Map();
async function fonteDoCorte(a, m, onProgress = () => {}) {
  if (!a.link?.corte) return { file: a.file, offset: 0 };
  const chave = `${a.id}|${m.inicio}|${m.fim}`;
  if (!trechosHQ.has(chave)) {
    const base = a.link.inicioAnalise ?? 0;
    const p = baixarHls(a.link.corte.url, { de: base + Math.max(0, m.inicio - 1.5), ate: base + m.fim + 1.5, nome: "trecho", onProgress })
      .then((r) => ({ file: r.file, offset: r.inicio - base }))
      .catch((e) => { trechosHQ.delete(chave); throw e; });
    trechosHQ.set(chave, p);
    if (trechosHQ.size > 12) trechosHQ.delete(trechosHQ.keys().next().value);
  }
  return trechosHQ.get(chave);
}
/** desloca os tempos do corte para o arquivo do trecho */
const ajustar = (c, offset) => (offset ? { ...c, inicio: c.inicio - offset, fim: c.fim - offset } : c);

/* ------------------------- transcrição (worker) ------------------------- */

let worker = null;
let reqId = 0;
const pend = new Map();
function transcrever(audio, model, lang, onDownload) {
  if (!worker) {
    worker = new Worker(new URL("./whisper-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      if (data.type === "download") worker._onDl?.(data);
      if (data.type === "result" || data.type === "error") {
        const p = pend.get(data.id);
        pend.delete(data.id);
        if (!p) return;
        data.type === "result" ? p.res(data.words) : p.rej(new Error(data.message));
      }
    };
    worker.onerror = (e) => { for (const p of pend.values()) p.rej(new Error(e.message || "Erro no Whisper")); pend.clear(); };
  }
  worker._onDl = onDownload;
  const id = ++reqId;
  return new Promise((res, rej) => {
    pend.set(id, { res, rej });
    const copia = new Float32Array(audio); // cópia própria (o buffer de um AudioBuffer não pode ser transferido)
    worker.postMessage({ type: "transcrever", id, audio: copia, model, lang }, [copia.buffer]);
  });
}

/* ------------------------- análise ------------------------- */

const SUGESTOES = {
  GRITO: ["Ele não esperava *isso*", "O susto *mais alto* da live", "Olha o que *aconteceu*"],
  "REAÇÃO": ["A reação dele *no final*", "Ele *não acreditou*", "Ninguém esperava *essa*"],
  "AÇÃO": ["A perseguição *mais insana*", "Isso foi *absurdo*", "O final dessa *fuga*"],
  RISADA: ["Eu *não aguentei*", "O momento *mais engraçado*", "Ele *chorou de rir*"],
};
const EMOJI = { GRITO: "😱", "REAÇÃO": "🤯", "AÇÃO": "💥", RISADA: "😂" };

function sugestoes(m) {
  const base = SUGESTOES[m.tipo] ?? SUGESTOES.GRITO;
  // frase falada perto do pico, entre aspas
  const w = (m.words ?? []).filter((x) => Math.abs(x.start - (m.pico - m.inicio)) < 4).map((x) => x.text.replace(/[.,!?]+$/, ""));
  const fala = w.length >= 2 ? `"${w.slice(0, 6).join(" ")}"` : null;
  return [...(fala ? [fala] : []), ...base];
}

$("#btnAnalisar").addEventListener("click", analisarTudo);
async function analisarTudo() {
  lerCfg1();
  const btn = $("#btnAnalisar");
  btn.disabled = true;
  const st = $("#statusAnalise");
  const log = (html) => (st.innerHTML = html);
  try {
    const todos = [];
    const validos = S.arquivos.filter((a) => !a.erro && a.duracao);
    for (const [i, a] of validos.entries()) {
      log(`<b>${i + 1}/${validos.length}</b> Ouvindo o áudio de ${esc(a.nome)}...`);
      a.status = "ouvindo o áudio...";
      const loud = await volume(a.file, a.duracao, { onProgress: (p) => { a.prog = p * (S.cfg.cenas ? 0.6 : 1); renderArquivosLeve(a); } });
      let cuts = [];
      if (S.cfg.cenas) {
        a.status = "olhando a imagem...";
        log(`<b>${i + 1}/${validos.length}</b> Olhando a imagem de ${esc(a.nome)}...`);
        cuts = await mudancasDeCena(a.file, a.duracao, { onProgress: (p) => { a.prog = 0.6 + 0.4 * p; renderArquivosLeve(a); } });
      }
      a.prog = 1;
      a.status = `${fmt(a.duracao)} · analisado`;
      renderArquivos();
      const cs = candidatos({ dur: a.duracao, loud, cuts, n: S.cfg.n * 2, alvo: S.cfg.alvo, min: Math.max(10, S.cfg.alvo * 0.5), max: S.cfg.alvo * 2 });
      todos.push(...cs.map((c) => ({ ...c, arquivoId: a.id })));
    }
    if (!todos.length) throw new Error("Não achei picos claros. Tente vídeos mais longos ou desligue a análise de imagem.");
    todos.sort((x, y) => y.nota - x.nota);
    const alvo = todos.slice(0, Math.min(todos.length, Math.ceil(S.cfg.n * 1.8)));
    const out = [];
    for (const [i, c] of alvo.entries()) {
      const a = S.arquivos.find((x) => x.id === c.arquivoId);
      log(`<b>Ouvindo a fala</b> do momento ${i + 1}/${alvo.length} (${fmt(c.inicio)})... <span id="dl"></span><div class="barra"><i style="width:${(100 * i) / alvo.length}%"></i></div>`);
      let words = [];
      try {
        const audio = await audioTrecho(a.file, c.inicio, c.fim);
        words = await transcrever(audio, S.cfg.modelo, S.cfg.idioma, (d) => {
          const el = $("#dl");
          if (el) el.textContent = `baixando a IA de legenda (só na 1ª vez): ${Math.round(d.progress)}%`;
        });
      } catch (e) {
        console.warn("transcrição", e);
        toast("Não consegui transcrever um trecho. Ele vai sem legenda.", true);
      }
      const r = refinar({ ...c, picos: c.picos.map((p) => p - c.inicio) }, words);
      r.picos = [r.pico - r.inicio, ...r.picos.map((p) => p + c.inicio - r.inicio).filter((p) => Math.abs(p - (r.pico - r.inicio)) > 1.5)].filter((p) => p >= 0.8 && p < r.fim - r.inicio - 0.5);
      r.thumb = await thumbnail(a.file, r.pico).catch(() => "");
      out.push(r);
    }
    out.sort((x, y) => y.nota - x.nota);
    S.momentos = out.map((r, i) => {
      const sug = sugestoes(r);
      return {
        id: `${Date.now().toString(36)}-${i}`, arquivoId: r.arquivoId, arquivoNome: r.arquivoId.split("|")[0],
        inicio: +r.inicio.toFixed(2), fim: +r.fim.toFixed(2), pico: r.pico, picos: r.picos.map((p) => +p.toFixed(2)),
        nota: +r.nota.toFixed(2), tipo: r.tipo, words: r.words, trecho: r.trecho, thumb: r.thumb,
        titulo: sug[1] ?? sug[0], titulosExtras: sug.slice(2, 4).join("\n"), emoji: EMOJI[r.tipo] ?? "🔥", legenda: "",
        aprovado: i < S.cfg.n,
      };
    });
    await salvar();
    log(`<b>${S.momentos.length} momentos encontrados.</b> Os ${Math.min(S.cfg.n, S.momentos.length)} melhores já estão aprovados.`);
    marcarFeito();
    ir("momentos");
  } catch (e) {
    console.error(e);
    log(`<span style="color:var(--red)">${esc(e.message)}</span>`);
    toast(e.message, true);
  } finally {
    btn.disabled = false;
  }
}
let leveT = 0;
function renderArquivosLeve() {
  const now = performance.now();
  if (now - leveT > 150) { leveT = now; renderArquivos(); }
}

function lerCfg1() {
  Object.assign(S.cfg, {
    n: +$("#cfgN").value || 6, alvo: +$("#cfgAlvo").value || 30, idioma: $("#cfgIdioma").value, modelo: $("#cfgModelo").value, cenas: $("#cfgCenas").checked,
  });
  salvar();
}

/* ------------------------- 2. momentos ------------------------- */

function renderMomentos() {
  const g = $("#gradeMomentos");
  if (!S.momentos.length) {
    g.innerHTML = `<p class="vazio">Nenhum momento ainda. Comece pela etapa 1.</p>`;
    return;
  }
  g.innerHTML = S.momentos
    .map((m) => {
      const dur = m.fim - m.inicio;
      return `<article class="mom ${m.aprovado ? "" : "off"}" data-id="${m.id}">
      <div class="thumb" data-play="${m.id}">${m.thumb ? `<img src="${m.thumb}" alt="">` : ""}<div class="play">▶</div>
        <span class="tag">${esc(m.emoji)} ${esc(m.tipo)}</span><span class="nota">nota ${m.nota.toFixed(1)}</span>
        <span class="tempo">${fmt(m.inicio)} · ${Math.round(dur)}s</span></div>
      <div class="corpo">
        <div class="linha"><button class="btn peq" data-editar="${m.id}">✂ Editar</button><small>${esc(m.arquivoNome)}${m.layout || m.jogo || m.facecam ? " · ajustado" : ""}</small>
          <label class="aprovar"><input type="checkbox" data-f="aprovado" ${m.aprovado ? "checked" : ""}> Aprovado</label></div>
        <label class="mini">Título (use *asteriscos* para destacar)<input data-f="titulo" value="${esc(m.titulo)}"></label>
        <div class="sug">${sugestoes(m).map((s) => `<button data-sug="${esc(s)}">${esc(s.replace(/\*/g, ""))}</button>`).join("")}</div>
        <label class="mini">Títulos extras para as variações (um por linha)<textarea data-f="titulosExtras" rows="2">${esc(m.titulosExtras)}</textarea></label>
        <div class="linha">
          <label class="mini" style="width:90px">Emoji<select data-f="emoji">${["😱", "🤯", "💥", "😂", "🔥", "💰", "👀", "💀", "🚨", "🏆"].map((e) => `<option ${e === m.emoji ? "selected" : ""}>${e}</option>`).join("")}</select></label>
          <div class="ajuste mini" style="display:grid;gap:4px;font-size:12px;color:var(--muted);font-weight:600">Início / fim
            <div class="linha"><button data-aj="i-2">−2s</button><button data-aj="i+2">+2s</button><span>·</span><button data-aj="f-2">−2s</button><button data-aj="f+2">+2s</button></div></div>
        </div>
        <label class="mini">Legenda do post (opcional)<textarea data-f="legenda" rows="2" placeholder="Se deixar vazio, uso o título">${esc(m.legenda)}</textarea></label>
        <div class="fala" title="clique para ver tudo">${esc(m.trecho || "(sem fala detectada)")}</div>
      </div></article>`;
    })
    .join("");
}

$("#gradeMomentos").addEventListener("input", (e) => {
  const card = e.target.closest(".mom");
  const f = e.target.dataset.f;
  if (!card || !f) return;
  const m = S.momentos.find((x) => x.id === card.dataset.id);
  m[f] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
  if (f === "aprovado") card.classList.toggle("off", !m.aprovado);
  salvar();
  marcarFeito();
});
$("#gradeMomentos").addEventListener("click", (e) => {
  const card = e.target.closest(".mom");
  if (!card) return;
  const m = S.momentos.find((x) => x.id === card.dataset.id);
  if (e.target.closest("[data-editar]")) {
    const a = S.arquivos.find((x) => x.id === m.arquivoId);
    if (!a?.file) return toast("Adicione de novo o vídeo original na etapa 1.", true);
    abrirEditor({
      m, file: a.file, duracaoArquivo: a.duracao, cfg: S.cfg, montarCorte: corteDe, audioTrecho,
      transcrever: (audio) => transcrever(audio, S.cfg.modelo, S.cfg.idioma),
      onSalvar: (novo) => {
        Object.assign(m, novo);
        salvar();
        renderMomentos();
        toast("Corte atualizado!");
      },
    });
    return;
  }
  const sug = e.target.closest("[data-sug]");
  if (sug) {
    m.titulo = sug.dataset.sug;
    card.querySelector('[data-f="titulo"]').value = m.titulo;
    salvar();
  }
  const aj = e.target.closest("[data-aj]");
  if (aj) {
    const [k, d] = [aj.dataset.aj[0], Number(aj.dataset.aj.slice(1))];
    if (k === "i") { const ni = Math.max(0, m.inicio + d); m.picos = m.picos.map((p) => p - (ni - m.inicio)).filter((p) => p >= 0.5); m.words = m.words.map((w) => ({ ...w, start: w.start - (ni - m.inicio), end: w.end - (ni - m.inicio) })); m.inicio = ni; }
    else m.fim = Math.max(m.inicio + 6, m.fim + d);
    card.querySelector(".tempo").textContent = `${fmt(m.inicio)} · ${Math.round(m.fim - m.inicio)}s`;
    salvar();
    toast(`Agora: ${fmt(m.inicio)} → ${fmt(m.fim)}`);
  }
  if (e.target.closest(".fala")) e.target.closest(".fala").classList.toggle("aberta");
  if (e.target.closest("[data-play]")) {
    const a = S.arquivos.find((x) => x.id === m.arquivoId);
    if (!a) return toast("Adicione de novo o vídeo original na etapa 1.", true);
    const v = $("#modalVideo");
    v.src = URL.createObjectURL(a.file) + `#t=${m.inicio},${m.fim}`;
    $("#modal").hidden = false;
    v.play().catch(() => {});
  }
});
$("#modalFechar").onclick = () => {
  const v = $("#modalVideo");
  v.pause();
  URL.revokeObjectURL(v.src.split("#")[0]);
  $("#modal").hidden = true;
};
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("#modalFechar").click(); });
$("#btnAprovarTodos").onclick = () => { S.momentos.forEach((m) => (m.aprovado = true)); salvar(); renderMomentos(); marcarFeito(); };

/* ------------------------- 3. estilo ------------------------- */

function renderEstilo() {
  const c = S.cfg;
  $("#cfgHandle").value = c.handle;
  $("#cfgPagina").value = c.pagina;
  $("#cfgHashtags").value = c.hashtags;
  $("#cfgPorCorte").value = c.porCorte;
  $("#temas").innerHTML = Object.entries(TEMAS).map(([k, t]) => `<button data-tema="${k}" class="${k === c.tema ? "sel" : ""}"><i style="background:linear-gradient(135deg,${t.primary},${t.accent})"></i>${t.nome}</button>`).join("");
  $$('#layouts input').forEach((i) => (i.checked = i.value === c.layout));
  $$("#templates input").forEach((i) => (i.checked = c.templates.includes(i.value)));
  $$("#intros input").forEach((i) => (i.checked = c.intros.includes(i.value)));
  renderCtas();
  $("#facecamBox").hidden = c.layout !== "split";
  if (c.layout === "split") desenharFacecam();
}
function renderCtas() {
  $("#ctas").innerHTML = S.cfg.ctas.map((x, i) => `<div class="cta-row" data-i="${i}"><input data-k="verb" value="${esc(x.verb)}" placeholder="Comenta"><input data-k="word" value="${esc(x.word)}" placeholder="PALAVRA"><button data-del="${i}" aria-label="Remover">×</button></div>`).join("");
}
$("#ctas").addEventListener("input", (e) => {
  const row = e.target.closest(".cta-row");
  S.cfg.ctas[row.dataset.i][e.target.dataset.k] = e.target.value;
  salvar();
});
$("#ctas").addEventListener("click", (e) => {
  const b = e.target.closest("[data-del]");
  if (!b || S.cfg.ctas.length <= 1) return;
  S.cfg.ctas.splice(+b.dataset.del, 1);
  renderCtas();
  salvar();
});
$("#btnAddCta").onclick = () => { if (S.cfg.ctas.length < 4) { S.cfg.ctas.push({ verb: "Comenta", word: "" }); renderCtas(); } };
$("#temas").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tema]");
  if (!b) return;
  S.cfg.tema = b.dataset.tema;
  $$("#temas button").forEach((x) => x.classList.toggle("sel", x === b));
  salvar();
  atualizarPrevia();
});
["#cfgHandle", "#cfgPagina", "#cfgHashtags", "#cfgPorCorte"].forEach((s) =>
  $(s).addEventListener("change", () => {
    S.cfg.handle = $("#cfgHandle").value.trim();
    if (S.cfg.handle && !S.cfg.handle.startsWith("@")) S.cfg.handle = "@" + S.cfg.handle;
    S.cfg.pagina = $("#cfgPagina").value.trim();
    S.cfg.hashtags = $("#cfgHashtags").value.trim();
    S.cfg.porCorte = Math.max(1, Math.min(8, +$("#cfgPorCorte").value || 3));
    salvar();
    atualizarPrevia();
  }),
);
$("#layouts").addEventListener("change", (e) => {
  S.cfg.layout = e.target.value;
  $("#facecamBox").hidden = S.cfg.layout !== "split";
  if (S.cfg.layout === "split") desenharFacecam();
  salvar();
  atualizarPrevia();
});
const lerChips = (sel) => $$(`${sel} input:checked`).map((i) => i.value);
$("#templates").addEventListener("change", () => { S.cfg.templates = lerChips("#templates"); if (!S.cfg.templates.length) S.cfg.templates = ["padrao"]; salvar(); });
$("#intros").addEventListener("change", () => { S.cfg.intros = lerChips("#intros"); if (!S.cfg.intros.length) S.cfg.intros = ["nenhuma"]; salvar(); });

// seletor da facecam
let fcImg = null;
async function desenharFacecam() {
  const cv = $("#facecamCanvas");
  const ctx = cv.getContext("2d");
  const m = S.momentos.find((x) => x.aprovado) ?? S.momentos[0];
  const a = S.arquivos.find((x) => x.id === m?.arquivoId) ?? S.arquivos[0];
  if (!a) { ctx.fillStyle = "#222"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.fillStyle = "#aaa"; ctx.font = "16px Inter"; ctx.fillText("Adicione um vídeo na etapa 1", 20, 40); return; }
  if (!fcImg || fcImg._id !== a.id) {
    const url = await thumbnail(a.file, m ? m.pico : Math.min(60, a.duracao / 2), 640);
    fcImg = new Image();
    fcImg._id = a.id;
    await new Promise((r) => { fcImg.onload = r; fcImg.src = url; });
    cv.height = Math.round((640 * fcImg.height) / fcImg.width);
  }
  ctx.drawImage(fcImg, 0, 0, cv.width, cv.height);
  const f = S.cfg.facecam ?? { x: 0.7, y: 0.65, w: 0.3, h: 0.35 };
  ctx.fillStyle = "rgba(0,0,0,.5)";
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(fcImg, f.x * fcImg.width, f.y * fcImg.height, f.w * fcImg.width, f.h * fcImg.height, f.x * cv.width, f.y * cv.height, f.w * cv.width, f.h * cv.height);
  ctx.strokeStyle = "#ff2d8a";
  ctx.lineWidth = 3;
  ctx.strokeRect(f.x * cv.width, f.y * cv.height, f.w * cv.width, f.h * cv.height);
}
{
  const cv = $("#facecamCanvas");
  let ini = null;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; };
  cv.addEventListener("pointerdown", (e) => { ini = pos(e); cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (!ini) return;
    const p = pos(e);
    S.cfg.facecam = { x: Math.min(ini.x, p.x), y: Math.min(ini.y, p.y), w: Math.max(0.05, Math.abs(p.x - ini.x)), h: Math.max(0.05, Math.abs(p.y - ini.y)) };
    desenharFacecam();
  });
  cv.addEventListener("pointerup", () => { ini = null; salvar(); atualizarPrevia(); });
}

function corteDe(m, extra = {}) {
  return {
    inicio: m.inicio, fim: m.fim, picos: m.picos, words: m.semLegenda ? [] : m.words, titulo: m.titulo, tag: m.tipo, emoji: m.emoji,
    tema: S.cfg.tema, layout: m.layout ?? S.cfg.layout, facecam: m.facecam ?? S.cfg.facecam, jogo: m.jogo ?? null,
    template: S.cfg.templates[0], intro: S.cfg.intros[0],
    cta: S.cfg.ctas.find((c) => c.word) ?? null, ...extra,
  };
}

let previaOcupada = false;
let previaDeNovo = false;
async function atualizarPrevia() {
  if (previaOcupada) { previaDeNovo = true; return; }
  const m = S.momentos.find((x) => x.aprovado) ?? S.momentos[0];
  const a = m && S.arquivos.find((x) => x.id === m.arquivoId);
  const msg = $("#previaMsg");
  const cv = $("#canvasPrevia");
  if (!a) {
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#120c1e";
    ctx.fillRect(0, 0, cv.width, cv.height);
    msg.textContent = m ? "Adicione de novo o vídeo original (etapa 1) para ver a prévia." : "A prévia aparece depois de encontrar os momentos.";
    return;
  }
  previaOcupada = true;
  try {
    const fase = $("#previaFase").value;
    const fonte = await fonteDoCorte(a, m, (p) => (msg.textContent = `Baixando o trecho em alta: ${Math.round(p * 100)}%`));
    const c = ajustar(corteDe(m, { template: $("#previaTpl").value }), fonte.offset);
    const dur = c.fim - c.inicio;
    if (fase === "cta") await previa(cv, fonte.file, { ...c, cta: c.cta ?? { verb: "Comenta", word: "CORTES" } }, S.cfg, "main", dur - 0.6);
    else if (fase === "letreiro") await previa(cv, fonte.file, c, S.cfg, "letreiro", 0.8);
    else if (fase === "teaser") await previa(cv, fonte.file, c, S.cfg, "teaser", 0.6);
    else await previa(cv, fonte.file, c, S.cfg, "main");
    msg.textContent = `Prévia de: ${m.titulo.replace(/\*/g, "")}`;
  } catch (e) {
    msg.textContent = "Não consegui gerar a prévia: " + e.message;
  } finally {
    previaOcupada = false;
    if (previaDeNovo) { previaDeNovo = false; atualizarPrevia(); }
  }
}
$("#btnPrevia").onclick = atualizarPrevia;
$("#previaTpl").onchange = atualizarPrevia;
$("#previaFase").onchange = atualizarPrevia;

/* ------------------------- 4. gerar (multiplicador) ------------------------- */

/** combina título × template × abertura × CTA e escolhe as N mais diferentes entre si */
function planejarVariacoes(m) {
  const titulos = [m.titulo, ...String(m.titulosExtras || "").split("\n").map((s) => s.trim()).filter(Boolean)].filter((t, i, a) => t && a.indexOf(t) === i);
  const ctas = S.cfg.ctas.filter((c) => c.word?.trim());
  const dims = [titulos, S.cfg.templates, S.cfg.intros, ctas.length ? ctas : [null]];
  const all = dims.reduce((acc, l) => acc.flatMap((a) => l.map((x) => [...a, x])), [[]]);
  const k = (v) => JSON.stringify(v);
  const pesos = [1.5, 1.3, 1, 1];
  const esc1 = [all[0]];
  while (esc1.length < Math.min(S.cfg.porCorte, all.length)) {
    let best = null, bs = -1;
    for (const c of all) {
      if (esc1.some((x) => k(x) === k(c))) continue;
      const dist = esc1.map((x) => c.reduce((d, v, i) => d + (k(v) !== k(x[i]) ? pesos[i] : 0), 0));
      const novos = c.reduce((n, v, i) => n + (esc1.some((x) => k(x[i]) === k(v)) ? 0 : 1), 0);
      const s = Math.min(...dist) * 100 + novos * 10 + dist.reduce((a, b) => a + b, 0);
      if (s > bs) { bs = s; best = c; }
    }
    esc1.push(best);
  }
  return esc1.map(([titulo, template, intro, cta]) => ({ titulo, template, intro, cta }));
}

function plano() {
  const aprovados = S.momentos.filter((m) => m.aprovado);
  return aprovados.flatMap((m, ordem) => planejarVariacoes(m).map((v, i) => ({ m, ordem, variacao: i + 1, ...v })));
}

function renderGerar() {
  const p = plano();
  const seg = p.reduce((a, x) => a + (x.m.fim - x.m.inicio) + introS(x.intro) + 1.5, 0);
  const n = S.momentos.filter((m) => m.aprovado).length;
  $("#resumoGerar").textContent = n
    ? `${n} cortes × até ${S.cfg.porCorte} versões = ${p.length} vídeos. Tempo estimado: ${Math.ceil(seg / 60)} min. Formato: ${formatoSaida().startsWith("video/mp4") ? "MP4" : "WebM (use o Chrome para sair em MP4)"}.`
    : "Aprove pelo menos um momento na etapa 2.";
  renderRenders();
}

let cancelar = { valor: false };
$("#btnGerar").onclick = async () => {
  const p = plano();
  if (!p.length) return toast("Aprove pelo menos um momento na etapa 2.", true);
  const faltam = [...new Set(p.map((x) => x.m.arquivoId))].filter((id) => !S.arquivos.some((a) => a.id === id));
  if (faltam.length) return toast(`Adicione de novo na etapa 1: ${faltam.map((f) => f.split("|")[0]).join(", ")}`, true);
  cancelar = { valor: false };
  $("#btnGerar").disabled = true;
  $("#btnCancelar").hidden = false;
  const fila = $("#fila");
  fila.innerHTML = p.map((x, i) => `<div class="item-fila" id="fi${i}"><b>${esc(x.titulo.replace(/\*/g, ""))}</b><small>corte ${x.ordem + 1} · versão ${x.variacao} · ${x.template} · ${x.intro}${x.cta ? " · " + esc(x.cta.word) : ""}</small><div class="barra"><i></i></div></div>`).join("");
  const wake = await navigator.wakeLock?.request("screen").catch(() => null);
  let ok = 0;
  for (const [i, x] of p.entries()) {
    if (cancelar.valor) break;
    const el = $(`#fi${i}`);
    el.scrollIntoView({ block: "nearest" });
    const a = S.arquivos.find((f) => f.id === x.m.arquivoId);
    try {
      el.querySelector("small").textContent += a.link ? " · baixando o trecho em alta..." : "";
      const fonte = await fonteDoCorte(a, x.m, (pr) => (el.querySelector("i").style.width = `${pr * 30}%`));
      const c = ajustar(corteDe(x.m, { titulo: x.titulo, template: x.template, intro: x.intro, cta: x.cta, parte: null }), fonte.offset);
      const { blob, mime } = await gravar(fonte.file, c, S.cfg, { onProgress: (pr) => (el.querySelector("i").style.width = `${pr * 100}%`), preview: $("#canvasAoVivo"), cancelar });
      const r = {
        id: `${x.m.id}-v${x.variacao}-${Date.now().toString(36)}`, corteId: x.m.id, ordem: x.ordem, variacao: x.variacao,
        titulo: x.titulo, template: x.template, intro: x.intro, cta: x.cta, tipo: x.m.tipo, legenda: x.m.legenda,
        mime, blob, criado: Date.now(), dur: x.m.fim - x.m.inicio + introS(x.intro),
      };
      S.renders = S.renders.filter((y) => !(y.corteId === r.corteId && y.variacao === r.variacao));
      S.renders.push(r);
      await db.put("renders", r);
      el.classList.add("ok");
      ok++;
      renderRenders();
    } catch (e) {
      if (e.message === "cancelado") break;
      console.error(e);
      el.classList.add("erro");
      el.querySelector("small").textContent = "Erro: " + e.message;
    }
  }
  wake?.release?.();
  $("#btnGerar").disabled = false;
  $("#btnCancelar").hidden = true;
  marcarFeito();
  toast(`${ok} vídeo(s) pronto(s)!`);
};
$("#btnCancelar").onclick = () => (cancelar.valor = true);

const urls = new Map();
const urlDe = (r) => {
  if (!urls.has(r.id)) urls.set(r.id, URL.createObjectURL(r.blob));
  return urls.get(r.id);
};
const ext = (r) => (r.mime?.includes("mp4") ? "mp4" : "webm");
const nomeArq = (r) => {
  const i = S.momentos.findIndex((m) => m.id === r.corteId);
  return `corte-${String((i >= 0 ? i : r.ordem) + 1).padStart(2, "0")}-v${r.variacao}.${ext(r)}`;
};

function renderRenders() {
  const g = $("#gradeRenders");
  const rs = [...S.renders].sort((a, b) => a.ordem - b.ordem || a.variacao - b.variacao);
  if (!rs.length) {
    g.innerHTML = `<p class="vazio">Nenhum vídeo gerado ainda.</p>`;
    return;
  }
  g.innerHTML = rs
    .map((r) => `<div class="rend"><video src="${urlDe(r)}" controls preload="metadata" playsinline></video><div class="info"><b>${esc(r.titulo.replace(/\*/g, ""))}</b><small>${nomeArq(r)} · ${r.template} · ${r.intro}</small><div class="linha"><a class="btn peq" href="${urlDe(r)}" download="${nomeArq(r)}">Baixar</a><button class="btn ghost peq" data-del-r="${r.id}">Apagar</button></div></div></div>`)
    .join("");
}
$("#gradeRenders").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-del-r]");
  if (!b) return;
  S.renders = S.renders.filter((r) => r.id !== b.dataset.delR);
  await db.del("renders", b.dataset.delR);
  renderRenders();
});
$("#btnZip").onclick = async () => {
  if (!S.renders.length) return toast("Nenhum vídeo gerado ainda.", true);
  if (!window.JSZip) return toast("Carregando o compactador, tente de novo em 2 s.", true);
  toast("Montando o .zip...");
  const z = new JSZip();
  for (const r of S.renders) z.file(nomeArq(r), r.blob);
  const posts = montarAgenda(S.renders, S.cfg);
  z.file("agenda.csv", csv(posts, (p) => nomeArq(S.renders.find((r) => r.id === p.renderId))));
  const blob = await z.generateAsync({ type: "blob", compression: "STORE" });
  baixar(blob, "cortes.zip");
};
function baixar(blob, nome) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ------------------------- 5. agenda ------------------------- */

function lerCfgAgenda() {
  Object.assign(S.cfg, {
    inicio: $("#cfgInicio").value, horarios: $("#cfgHorarios").value, rodadas: +$("#cfgRodadas").value || 1, lembrete: +$("#cfgLembrete").value || 0,
    redes: lerChips("#redes"),
  });
  salvar();
}
["#cfgInicio", "#cfgHorarios", "#cfgRodadas", "#cfgLembrete"].forEach((s) => $(s).addEventListener("change", () => { lerCfgAgenda(); renderAgenda(); }));
$("#redes").addEventListener("change", () => { lerCfgAgenda(); renderAgenda(); });

const fmtDia = (d) => { const s = new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }); return s.charAt(0).toUpperCase() + s.slice(1); };
let postsAtuais = [];

function renderAgenda() {
  renderPostiz();
  if (!S.cfg.inicio) S.cfg.inicio = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  $("#cfgInicio").value = S.cfg.inicio;
  $("#cfgHorarios").value = S.cfg.horarios;
  $("#cfgRodadas").value = S.cfg.rodadas;
  $("#cfgLembrete").value = S.cfg.lembrete;
  $$("#redes input").forEach((i) => (i.checked = S.cfg.redes.includes(i.value)));
  const lista = $("#listaAgenda");
  if (!S.renders.length) {
    lista.innerHTML = `<p class="vazio">Gere os vídeos na etapa 4 para montar a agenda.</p>`;
    $("#statsAgenda").textContent = "";
    return;
  }
  postsAtuais = montarAgenda(S.renders, S.cfg);
  let html = "", dia = null, hora = null;
  for (const p of postsAtuais) {
    if (p.dia !== dia) { if (dia) html += "</div>"; dia = p.dia; hora = null; html += `<h3 class="dia">${fmtDia(p.dia)}</h3><div>`; }
    if (p.hora !== hora) { if (hora) html += "</div>"; hora = p.hora; html += `<div class="slot">${p.hora} · ${esc(p.titulo)}</div><div class="grade-posts">`; }
    const r = S.renders.find((x) => x.id === p.renderId);
    html += `<article class="post ${S.postados[p.id] ? "feito" : ""}" data-p="${esc(p.id)}">
      <div class="cab"><span class="badge ${p.rede}">${REDES[p.rede]}</span><span>${p.hora}</span>${S.enviados[p.id] ? `<span class="enviado">✓ agendado no Postiz</span>` : ""}<small>versão ${p.variacao} · ${p.template}</small></div>
      <video src="${urlDe(r)}" controls preload="metadata" playsinline></video>
      <div class="corpo">${p.tituloYt ? `<div class="yt">${esc(p.tituloYt)}</div>` : ""}
        <textarea rows="4">${esc(p.texto)}</textarea>
        <div class="linha"><button class="btn peq" data-copy>Copiar legenda</button>${p.tituloYt ? `<button class="btn ghost peq" data-copy-t>Copiar título</button>` : ""}
          <a class="btn ghost peq" href="${urlDe(r)}" download="${p.dia}_${p.hora.replace(":", "")}_${p.rede}_${nomeArq(r)}">Baixar</a>
          <label class="ok"><input type="checkbox" ${S.postados[p.id] ? "checked" : ""}> Postado</label></div></div></article>`;
  }
  html += "</div></div>";
  lista.innerHTML = html;
  statsAgenda();
}
function statsAgenda() {
  const n = postsAtuais.filter((p) => S.postados[p.id]).length;
  const nx = postsAtuais.find((p) => !S.postados[p.id]);
  $("#statsAgenda").textContent = `${n} de ${postsAtuais.length} postados · próximo: ${nx ? `${new Date(nx.dia + "T12:00:00").toLocaleDateString("pt-BR")} ${nx.hora} no ${REDES[nx.rede]}` : "tudo postado 🎉"}`;
  $("#barraAgenda").style.width = `${(100 * n) / Math.max(1, postsAtuais.length)}%`;
}
async function copiar(t) {
  try { await navigator.clipboard.writeText(t); } catch { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
  toast("Copiado!");
}
$("#listaAgenda").addEventListener("click", (e) => {
  const card = e.target.closest(".post");
  if (!card) return;
  const p = postsAtuais.find((x) => x.id === card.dataset.p);
  if (e.target.closest("[data-copy]")) copiar(card.querySelector("textarea").value);
  if (e.target.closest("[data-copy-t]")) copiar(p.tituloYt);
});
$("#listaAgenda").addEventListener("change", (e) => {
  if (e.target.type !== "checkbox") return;
  const card = e.target.closest(".post");
  if (e.target.checked) S.postados[card.dataset.p] = Date.now();
  else delete S.postados[card.dataset.p];
  card.classList.toggle("feito", e.target.checked);
  salvar();
  statsAgenda();
});
const nomeDoPost = (p) => nomeArq(S.renders.find((r) => r.id === p.renderId));
$("#btnIcs").onclick = () => { if (!postsAtuais.length) return toast("Gere os vídeos primeiro.", true); baixar(new Blob([ics(postsAtuais, S.cfg, nomeDoPost)], { type: "text/calendar" }), "agenda-cortes.ics"); };
$("#btnCsv").onclick = () => { if (!postsAtuais.length) return toast("Gere os vídeos primeiro.", true); baixar(new Blob(["﻿" + csv(postsAtuais, nomeDoPost)], { type: "text/csv" }), "agenda-cortes.csv"); };


/* ------------------------- 5b. Postiz ------------------------- */

let pzLista = [];
const pzCfg = () => (S.cfg.postiz ??= { chave: "", base: "", mapa: {}, tiktokPrivacidade: "PUBLIC_TO_EVERYONE", youtubeVisibilidade: "public" });
function renderPostiz() {
  const c = pzCfg();
  $("#pzChave").value = c.chave;
  $("#pzBase").value = c.base;
  $("#pzTiktok").value = c.tiktokPrivacidade;
  $("#pzYoutube").value = c.youtubeVisibilidade;
  $("#pzCanais").hidden = !pzLista.length;
  $("#pzMapa").innerHTML = ["instagram", "tiktok", "youtube"]
    .map((rede) => {
      const ops = pzLista.filter((x) => redeDoCanal(x) === rede);
      return `<label>${REDES[rede]}<select data-rede="${rede}"><option value="">Não publicar</option>${ops.map((o) => `<option value="${esc(o.id)}" ${c.mapa[rede] === o.id ? "selected" : ""}>${esc(o.name)}</option>`).join("")}</select></label>`;
    })
    .join("");
}
$("#pzConectar").onclick = async () => {
  const c = pzCfg();
  c.chave = $("#pzChave").value.trim();
  c.base = $("#pzBase").value.trim();
  if (!c.chave) return toast("Cole a chave da API do Postiz.", true);
  $("#pzConectar").disabled = true;
  try {
    pzLista = await pzCanais(c);
    // escolhe sozinho quando há um canal só por rede
    for (const rede of ["instagram", "tiktok", "youtube"]) {
      const ops = pzLista.filter((x) => redeDoCanal(x) === rede);
      if (!c.mapa[rede] && ops.length === 1) c.mapa[rede] = ops[0].id;
    }
    salvar();
    renderPostiz();
    toast(pzLista.length ? `${pzLista.length} canal(is) encontrados no Postiz` : "Conectado, mas não há redes conectadas no Postiz ainda.");
  } catch (e) {
    toast(e.message, true);
  } finally {
    $("#pzConectar").disabled = false;
  }
};
$("#pzMapa").addEventListener("change", (e) => {
  pzCfg().mapa[e.target.dataset.rede] = e.target.value || undefined;
  salvar();
});
$("#pzTiktok").onchange = () => { pzCfg().tiktokPrivacidade = $("#pzTiktok").value; salvar(); };
$("#pzYoutube").onchange = () => { pzCfg().youtubeVisibilidade = $("#pzYoutube").value; salvar(); };
let pzCancel = { valor: false };
$("#pzCancelar").onclick = () => (pzCancel.valor = true);
$("#pzAgendar").onclick = async () => {
  if (!postsAtuais.length) return toast("Gere os vídeos primeiro.", true);
  const c = pzCfg();
  if (!Object.values(c.mapa).some(Boolean)) return toast("Escolha pelo menos uma rede para publicar.", true);
  pzCancel = { valor: false };
  $("#pzAgendar").disabled = true;
  $("#pzCancelar").hidden = false;
  const log = (txt, pr) => { $("#pzLog").textContent = txt; if (pr != null) $("#pzBarra").style.width = `${pr * 100}%`; };
  try {
    const r = await pzAgendar({ posts: postsAtuais, renders: S.renders, cfg: { ...c, fuso: S.cfg.fuso || "America/Sao_Paulo" }, canaisLista: pzLista, enviados: S.enviados, log, cancelar: pzCancel });
    salvar();
    log(`${r.agendados} post(s) agendados no Postiz.${r.pulados ? ` ${r.pulados} ficaram de fora (horário já passou ou rede sem canal).` : ""}`, 1);
    renderAgenda();
  } catch (e) {
    salvar();
    log("Parou: " + e.message);
    toast(e.message, true);
    renderAgenda();
  } finally {
    $("#pzAgendar").disabled = false;
    $("#pzCancelar").hidden = true;
  }
};

/* ------------------------- limpar / iniciar ------------------------- */

$("#btnLimpar").onclick = async () => {
  if (!confirm("Apagar momentos, vídeos gerados e agenda deste navegador?")) return;
  await db.clear("renders");
  await db.clear("kv");
  location.reload();
};

(async function iniciar() {
  const est = await db.get("kv", "estado");
  if (est) {
    S.cfg = { ...CFG_PADRAO, ...est.cfg };
    S.momentos = est.momentos ?? [];
    S.postados = est.postados ?? {};
    S.links = est.links ?? [];
    S.enviados = est.enviados ?? {};
  }
  S.renders = (await db.all("renders")) ?? [];
  $("#cfgN").value = S.cfg.n;
  $("#cfgAlvo").value = S.cfg.alvo;
  $("#cfgIdioma").value = S.cfg.idioma;
  $("#cfgModelo").value = S.cfg.modelo;
  $("#cfgCenas").checked = S.cfg.cenas;
  ["#cfgN", "#cfgAlvo", "#cfgIdioma", "#cfgModelo", "#cfgCenas"].forEach((s) => $(s).addEventListener("change", lerCfg1));
  renderArquivos();
  marcarFeito();
  if (!window.AudioDecoder || !window.MediaRecorder) toast("Use o Google Chrome atualizado no computador para tudo funcionar.", true);
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
})();

// para testes automatizados
window.__cortes = { S, ir, addArquivos, _teste: { audioTrecho, transcrever } };
