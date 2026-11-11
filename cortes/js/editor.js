// Editor simples de um momento: início/fim na linha do tempo (com onda do áudio), picos,
// recorte do jogo/facecam e correção da legenda palavra por palavra, com prévia ao vivo.
import { desenhaQuadro, W, H } from "./render.js";

const MARGEM = 12; // segundos de contexto antes/depois do corte
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (s) => {
  s = Math.max(0, s);
  const m = Math.floor(s / 60), ss = (s % 60).toFixed(1).padStart(4, "0");
  return `${m}:${ss}`;
};

/**
 * opts: { m, file, duracaoArquivo, cfg, montarCorte(m, extra), audioTrecho, transcrever, onSalvar(novo) }
 */
export function abrirEditor(opts) {
  const { m, file, cfg } = opts;
  // estado em tempo ABSOLUTO (segundos do arquivo)
  const st = {
    inicio: m.inicio,
    fim: m.fim,
    picos: (m.picos ?? []).map((p) => p + m.inicio),
    words: (m.words ?? []).map((w) => ({ ...w, start: w.start + m.inicio, end: w.end + m.inicio })),
    layout: m.layout ?? null,
    jogo: m.jogo ?? null,
    facecam: m.facecam ?? null,
    semLegenda: !!m.semLegenda,
  };
  const janela = [Math.max(0, m.inicio - MARGEM), Math.min(opts.duracaoArquivo ?? m.fim + MARGEM, m.fim + MARGEM)];
  let onda = null;
  let rectModo = null; // "jogo" | "facecam" | null

  const el = document.createElement("div");
  el.className = "editor";
  el.innerHTML = `
  <div class="editor-in" role="dialog" aria-label="Editar corte">
    <header class="ed-topo">
      <b>Editar corte</b><span class="ed-titulo">${esc(m.titulo.replace(/\*/g, ""))}</span>
      <div class="acoes"><button class="btn ghost" data-a="cancelar">Cancelar</button><button class="btn" data-a="salvar">Salvar</button></div>
    </header>
    <div class="ed-grid">
      <div class="ed-video">
        <div class="ed-palco">
          <video playsinline preload="auto"></video>
          <canvas class="ed-rect"></canvas>
        </div>
        <div class="ed-controles">
          <button class="btn peq" data-a="play">▶ Tocar</button>
          <button class="btn ghost peq" data-a="ini">⇤ Início aqui</button>
          <button class="btn ghost peq" data-a="fim">Fim aqui ⇥</button>
          <button class="btn ghost peq" data-a="pico">💥 Pico aqui</button>
          <span class="ed-tempo"></span>
        </div>
        <canvas class="ed-linha" height="120"></canvas>
        <p class="dica">Arraste as alças rosa para mudar início e fim. Clique na linha para ir até um ponto. Clique num 💥 para remover o pico.</p>
        <div class="ed-recorte">
          <label>Layout deste corte
            <select data-a="layout"><option value="">Padrão do estilo</option><option value="blur">Fundo desfocado</option><option value="split">Jogo + facecam</option><option value="crop">Tela cheia</option></select>
          </label>
          <button class="btn ghost peq" data-a="rect-jogo">Recortar o jogo</button>
          <button class="btn ghost peq" data-a="rect-face">Marcar a facecam</button>
          <button class="btn ghost peq" data-a="rect-limpar">Tirar recortes</button>
          <span class="dica ed-rect-dica"></span>
        </div>
      </div>
      <div class="ed-lado">
        <div class="ed-previa"><canvas width="270" height="480"></canvas><small>Prévia ao vivo</small></div>
        <div class="ed-legenda">
          <div class="linha"><b>Legenda</b>
            <label class="ed-check"><input type="checkbox" data-a="semleg"> sem legenda</label>
            <button class="btn ghost peq" data-a="refazer">Refazer legenda</button></div>
          <p class="dica">Corrija as palavras. Clique no tempo para ir até ela.</p>
          <div class="ed-palavras"></div>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(el);
  document.body.style.overflow = "hidden";

  const v = el.querySelector("video");
  const url = URL.createObjectURL(file);
  v.src = url;
  const linha = el.querySelector(".ed-linha");
  const rectCv = el.querySelector(".ed-rect");
  const prev = el.querySelector(".ed-previa canvas");
  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  el.querySelector('[data-a="layout"]').value = st.layout ?? "";
  el.querySelector('[data-a="semleg"]').checked = st.semLegenda;

  /* ---------- onda do áudio ---------- */
  (async () => {
    try {
      const a = await opts.audioTrecho(file, janela[0], janela[1]);
      const n = 600, passo = Math.floor(a.length / n);
      onda = Array.from({ length: n }, (_, i) => {
        let s = 0;
        for (let k = i * passo; k < (i + 1) * passo; k++) s += a[k] * a[k];
        return Math.sqrt(s / Math.max(1, passo));
      });
      const mx = Math.max(...onda, 1e-6);
      onda = onda.map((x) => x / mx);
    } catch (e) {
      console.warn("onda do áudio:", e);
      onda = [];
    }
  })();

  /* ---------- linha do tempo ---------- */
  const X = (t) => ((t - janela[0]) / (janela[1] - janela[0])) * linha.width;
  const T = (x) => janela[0] + (x / linha.width) * (janela[1] - janela[0]);
  function desenharLinha() {
    const dpr = window.devicePixelRatio || 1;
    const w = linha.clientWidth * dpr;
    if (linha.width !== w) {
      linha.width = w;
      linha.height = 120 * dpr;
    }
    const g = linha.getContext("2d");
    const h = linha.height;
    g.clearRect(0, 0, linha.width, h);
    g.fillStyle = "#120c1e";
    g.fillRect(0, 0, linha.width, h);
    // onda
    if (onda?.length) {
      g.fillStyle = "#4a3a66";
      const bw = linha.width / onda.length;
      onda.forEach((a, i) => g.fillRect(i * bw, h * 0.55 - a * h * 0.35, Math.max(1, bw - 0.5), a * h * 0.7));
    }
    // trecho escolhido
    const xi = X(st.inicio), xf = X(st.fim);
    g.fillStyle = "rgba(255,45,138,.18)";
    g.fillRect(xi, 0, xf - xi, h);
    g.fillStyle = "#ff2d8a";
    g.fillRect(xi - 3 * dpr, 0, 6 * dpr, h);
    g.fillRect(xf - 3 * dpr, 0, 6 * dpr, h);
    // palavras
    g.fillStyle = "rgba(255,181,71,.7)";
    for (const w of st.words) g.fillRect(X(w.start), h - 10 * dpr, Math.max(1, X(w.end) - X(w.start)), 6 * dpr);
    // picos
    g.font = `${16 * dpr}px sans-serif`;
    g.textAlign = "center";
    for (const p of st.picos) g.fillText("💥", X(p), 20 * dpr);
    // cursor
    g.fillStyle = "#fff";
    g.fillRect(X(v.currentTime) - dpr, 0, 2 * dpr, h);
    // duração
    g.fillStyle = "#fff";
    g.font = `600 ${12 * dpr}px Inter, sans-serif`;
    g.textAlign = "left";
    g.fillText(`${(st.fim - st.inicio).toFixed(1)} s`, xi + 8 * dpr, h - 16 * dpr);
  }
  let arrasto = null;
  linha.addEventListener("pointerdown", (e) => {
    const r = linha.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * linha.width;
    const tol = 10 * (window.devicePixelRatio || 1);
    const pico = st.picos.findIndex((p) => Math.abs(X(p) - x) < tol && e.clientY - r.top < 30);
    if (pico >= 0) {
      st.picos.splice(pico, 1);
      return;
    }
    if (Math.abs(x - X(st.inicio)) < tol) arrasto = "inicio";
    else if (Math.abs(x - X(st.fim)) < tol) arrasto = "fim";
    else v.currentTime = T(x);
    linha.setPointerCapture(e.pointerId);
  });
  linha.addEventListener("pointermove", (e) => {
    const r = linha.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * linha.width;
    const tol = 10 * (window.devicePixelRatio || 1);
    linha.style.cursor = Math.abs(x - X(st.inicio)) < tol || Math.abs(x - X(st.fim)) < tol ? "ew-resize" : "pointer";
    if (!arrasto) return;
    const t = Math.max(janela[0], Math.min(janela[1], T(x)));
    if (arrasto === "inicio") st.inicio = Math.min(t, st.fim - 3);
    else st.fim = Math.max(t, st.inicio + 3);
    v.currentTime = arrasto === "inicio" ? st.inicio : st.fim;
  });
  linha.addEventListener("pointerup", () => (arrasto = null));

  /* ---------- recorte (jogo / facecam) ---------- */
  function desenharRect() {
    const box = v.getBoundingClientRect();
    rectCv.width = box.width;
    rectCv.height = box.height;
    const g = rectCv.getContext("2d");
    g.clearRect(0, 0, rectCv.width, rectCv.height);
    rectCv.style.pointerEvents = rectModo ? "auto" : "none";
    const desenha = (r, cor, nome) => {
      if (!r) return;
      g.strokeStyle = cor;
      g.lineWidth = 3;
      g.strokeRect(r.x * rectCv.width, r.y * rectCv.height, r.w * rectCv.width, r.h * rectCv.height);
      g.fillStyle = cor;
      g.font = "700 13px Inter, sans-serif";
      g.fillText(nome, r.x * rectCv.width + 6, r.y * rectCv.height + 18);
      for (const [cx, cy] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]]) g.fillRect(cx * rectCv.width - 5, cy * rectCv.height - 5, 10, 10);
    };
    if (rectModo) {
      g.fillStyle = "rgba(0,0,0,.25)";
      g.fillRect(0, 0, rectCv.width, rectCv.height);
    }
    desenha(st.jogo, "#ffb547", "JOGO");
    desenha(st.facecam ?? (efetivo().layout === "split" ? cfg.facecam : null), "#ff2d8a", "FACECAM");
  }
  let rArr = null;
  const posR = (e) => {
    const r = rectCv.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
  };
  rectCv.addEventListener("pointerdown", (e) => {
    if (!rectModo) return;
    const p = posR(e);
    const k = rectModo === "jogo" ? "jogo" : "facecam";
    const r = st[k];
    const tolx = 14 / rectCv.width, toly = 14 / rectCv.height;
    if (r) {
      const cantos = { tl: [r.x, r.y], tr: [r.x + r.w, r.y], bl: [r.x, r.y + r.h], br: [r.x + r.w, r.y + r.h] };
      for (const [nome, [cx, cy]] of Object.entries(cantos)) if (Math.abs(p.x - cx) < tolx && Math.abs(p.y - cy) < toly) rArr = { tipo: nome, k };
      if (!rArr && p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h) rArr = { tipo: "mover", k, dx: p.x - r.x, dy: p.y - r.y };
    }
    if (!rArr) {
      rArr = { tipo: "novo", k, ox: p.x, oy: p.y };
      st[k] = { x: p.x, y: p.y, w: 0.01, h: 0.01 };
    }
    rectCv.setPointerCapture(e.pointerId);
  });
  rectCv.addEventListener("pointermove", (e) => {
    if (!rArr) return;
    const p = posR(e);
    const r = { ...st[rArr.k] };
    if (rArr.tipo === "novo") Object.assign(r, { x: Math.min(rArr.ox, p.x), y: Math.min(rArr.oy, p.y), w: Math.abs(p.x - rArr.ox), h: Math.abs(p.y - rArr.oy) });
    else if (rArr.tipo === "mover") Object.assign(r, { x: Math.max(0, Math.min(1 - r.w, p.x - rArr.dx)), y: Math.max(0, Math.min(1 - r.h, p.y - rArr.dy)) });
    else {
      const x2 = r.x + r.w, y2 = r.y + r.h;
      if (rArr.tipo.includes("l")) r.x = Math.min(p.x, x2 - 0.05);
      if (rArr.tipo.includes("r")) r.w = Math.max(0.05, p.x - r.x);
      else r.w = x2 - r.x;
      if (rArr.tipo.includes("t")) r.y = Math.min(p.y, y2 - 0.05);
      if (rArr.tipo.includes("b")) r.h = Math.max(0.05, p.y - r.y);
      else r.h = y2 - r.y;
    }
    st[rArr.k] = r;
  });
  rectCv.addEventListener("pointerup", () => {
    if (rArr && st[rArr.k] && (st[rArr.k].w < 0.05 || st[rArr.k].h < 0.05)) st[rArr.k] = null;
    rArr = null;
  });
  const modoRect = (m2) => {
    rectModo = rectModo === m2 ? null : m2;
    el.querySelector(".ed-rect-dica").textContent = rectModo === "jogo" ? "Arraste um retângulo na área do jogo que deve aparecer (tire o chat, por exemplo)." : rectModo === "facecam" ? "Arraste um retângulo em cima do rosto do streamer." : "";
    if (rectModo) v.pause();
  };

  /* ---------- legenda ---------- */
  function renderPalavras() {
    const box = el.querySelector(".ed-palavras");
    box.classList.toggle("off", st.semLegenda);
    const ws = st.words.filter((w) => w.end >= st.inicio - 0.2 && w.start <= st.fim + 0.2);
    box.innerHTML = ws.length
      ? ws.map((w) => `<div class="ed-pal" data-i="${st.words.indexOf(w)}"><button class="ed-t" data-a="ir">${fmt(w.start - st.inicio)}</button><input value="${esc(w.text)}"><button class="ed-x" data-a="del" aria-label="Apagar palavra">×</button></div>`).join("")
      : `<p class="dica">Nenhuma palavra neste trecho.</p>`;
  }
  el.querySelector(".ed-palavras").addEventListener("input", (e) => {
    const row = e.target.closest(".ed-pal");
    if (row) st.words[+row.dataset.i].text = e.target.value;
  });
  el.querySelector(".ed-palavras").addEventListener("click", (e) => {
    const row = e.target.closest(".ed-pal");
    if (!row) return;
    const w = st.words[+row.dataset.i];
    if (e.target.dataset.a === "ir") v.currentTime = w.start;
    if (e.target.dataset.a === "del") {
      st.words.splice(+row.dataset.i, 1);
      renderPalavras();
    }
  });

  /* ---------- botões ---------- */
  const fechar = () => {
    rodando = false;
    v.pause();
    URL.revokeObjectURL(url);
    document.body.style.overflow = "";
    el.remove();
  };
  el.addEventListener("click", async (e) => {
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (!a) return;
    if (a === "cancelar") fechar();
    if (a === "play") {
      if (v.paused) {
        if (v.currentTime < st.inicio || v.currentTime >= st.fim - 0.1) v.currentTime = st.inicio;
        v.play();
      } else v.pause();
    }
    if (a === "ini") st.inicio = Math.min(v.currentTime, st.fim - 3);
    if (a === "fim") st.fim = Math.max(v.currentTime, st.inicio + 3);
    if (a === "pico" && !st.picos.some((p) => Math.abs(p - v.currentTime) < 1)) st.picos.push(v.currentTime);
    if (a === "rect-jogo") modoRect("jogo");
    if (a === "rect-face") modoRect("facecam");
    if (a === "rect-limpar") {
      st.jogo = null;
      st.facecam = null;
      rectModo = null;
    }
    if (a === "refazer") {
      const b = e.target;
      b.disabled = true;
      b.textContent = "Ouvindo...";
      try {
        const audio = await opts.audioTrecho(file, st.inicio, st.fim);
        const ws = await opts.transcrever(audio);
        st.words = [...st.words.filter((w) => w.end < st.inicio || w.start > st.fim), ...ws.map((w) => ({ ...w, start: w.start + st.inicio, end: w.end + st.inicio }))].sort((x, y) => x.start - y.start);
        renderPalavras();
      } catch (err) {
        alert("Não consegui refazer a legenda: " + err.message);
      }
      b.disabled = false;
      b.textContent = "Refazer legenda";
    }
    if (a === "salvar") {
      const ini = +st.inicio.toFixed(2), fim = +st.fim.toFixed(2);
      opts.onSalvar({
        inicio: ini,
        fim,
        picos: st.picos.filter((p) => p > ini + 0.5 && p < fim - 0.5).sort((x, y) => x - y).map((p) => +(p - ini).toFixed(2)),
        words: st.words.filter((w) => w.end > ini && w.start < fim && w.text.trim()).map((w) => ({ text: w.text.trim(), start: +(w.start - ini).toFixed(2), end: +(w.end - ini).toFixed(2) })),
        layout: st.layout || null,
        jogo: st.jogo,
        facecam: st.facecam,
        semLegenda: st.semLegenda,
      });
      fechar();
    }
    if (a !== "salvar" && a !== "cancelar" && a !== "refazer") renderPalavras();
  });
  el.querySelector('[data-a="layout"]').addEventListener("change", (e) => (st.layout = e.target.value || null));
  el.querySelector('[data-a="semleg"]').addEventListener("change", (e) => {
    st.semLegenda = e.target.checked;
    renderPalavras();
  });
  const tecla = (e) => {
    if (!document.body.contains(el)) return document.removeEventListener("keydown", tecla);
    if (e.key === "Escape") fechar();
    if (e.key === " " && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) {
      e.preventDefault();
      el.querySelector('[data-a="play"]').click();
    }
  };
  document.addEventListener("keydown", tecla);

  /* ---------- corte "efetivo" (para a prévia) ---------- */
  function efetivo() {
    const base = opts.montarCorte(m, {});
    const ws = st.semLegenda ? [] : st.words.map((w) => ({ ...w, start: w.start - st.inicio, end: w.end - st.inicio }));
    return {
      ...base,
      inicio: st.inicio,
      fim: st.fim,
      picos: st.picos.map((p) => p - st.inicio),
      words: ws,
      _grupos: undefined,
      layout: st.layout ?? base.layout,
      jogo: st.jogo,
      facecam: st.facecam ?? base.facecam,
    };
  }

  /* ---------- laço de desenho ---------- */
  let rodando = true;
  let ultimoC = null, chaveC = "", ultimoT = -1, ultimoDesenho = 0;
  const loop = () => {
    if (!rodando) return;
    if (!v.paused && v.currentTime >= st.fim) v.pause();
    el.querySelector('[data-a="play"]').textContent = v.paused ? "▶ Tocar" : "⏸ Pausar";
    el.querySelector(".ed-tempo").textContent = `${fmt(v.currentTime - st.inicio)} · corte de ${(st.fim - st.inicio).toFixed(1)} s`;
    desenharLinha();
    desenharRect();
    // a prévia (1080x1920) é pesada: só redesenha quando algo mudou, no máximo ~15x por segundo
    const agora = performance.now();
    if (v.readyState >= 2 && agora - ultimoDesenho > 66) {
      const chave = JSON.stringify([st.inicio, st.fim, st.picos, st.layout, st.jogo, st.facecam, st.semLegenda, st.words.length, st.words.map((w) => w.text).join("")]);
      if (chave !== chaveC || v.currentTime !== ultimoT || !v.paused) {
        if (chave !== chaveC) {
          ultimoC = efetivo();
          chaveC = chave;
        }
        ultimoT = v.currentTime;
        ultimoDesenho = agora;
        const t = Math.max(0, v.currentTime - st.inicio);
        desenhaQuadro(off.getContext("2d"), v, ultimoC, cfg, "main", Math.min(t, st.fim - st.inicio - 2.7));
        prev.getContext("2d").drawImage(off, 0, 0, prev.width, prev.height);
      }
    }
    requestAnimationFrame(loop);
  };
  v.addEventListener("loadeddata", () => {
    v.currentTime = st.inicio;
    renderPalavras();
    requestAnimationFrame(loop);
  }, { once: true });
}
