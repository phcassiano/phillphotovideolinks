// Agenda: distribui os cortes em horários e dá a CADA REDE uma variação diferente do mesmo corte.

export const REDES = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube Shorts" };

const limpa = (t) => (t ?? "").replace(/\*/g, "").replace(/\s+/g, " ").trim();
const frase = (t) => {
  const s = limpa(t).toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function legenda(r, rede, cfg) {
  const texto = r.legenda?.trim() ? r.legenda.trim() : `${frase(r.titulo)} ${r.tipo === "RISADA" ? "😂" : "🔥"}`;
  const tags = (cfg.hashtags || "#gta6 #gtavi #gta #cortes #gameplay").split(/[\s,]+/).filter(Boolean).slice(0, 5);
  const cta = r.cta?.word ? `💬 ${r.cta.verb || "Comenta"} ${r.cta.word}` : "";
  if (rede === "youtube") return { tituloYt: `${frase(r.titulo)}`.slice(0, 88) + " #shorts", texto: [texto, cta, tags.join(" ")].filter(Boolean).join("\n\n") };
  if (rede === "tiktok") return { texto: [texto, cta, [...tags, "#fyp"].join(" ")].filter(Boolean).join(" ") };
  return { texto: [texto, cta, tags.join(" ")].filter(Boolean).join("\n\n") };
}

/** renders: [{id, corteId, variacao, titulo, ...}] */
export function montarAgenda(renders, cfg) {
  const redes = cfg.redes?.length ? cfg.redes : ["instagram", "tiktok", "youtube"];
  const horarios = (cfg.horarios || "12:00, 18:30, 21:00").split(/[\s,;]+/).filter((h) => /^\d{1,2}:\d{2}$/.test(h)).map((h) => h.padStart(5, "0"));
  if (!horarios.length) horarios.push("12:00");
  const inicio = cfg.inicio || new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const rodadas = Math.max(1, Number(cfg.rodadas || 1));
  const porCorte = new Map();
  for (const r of [...renders].sort((a, b) => a.ordem - b.ordem || a.variacao - b.variacao)) {
    if (!porCorte.has(r.corteId)) porCorte.set(r.corteId, []);
    porCorte.get(r.corteId).push(r);
  }
  const posts = [];
  let slot = 0;
  for (let rod = 0; rod < rodadas; rod++) {
    for (const [corteId, vars] of porCorte) {
      const dia = new Date(Date.parse(inicio + "T00:00:00Z") + Math.floor(slot / horarios.length) * 864e5).toISOString().slice(0, 10);
      const hora = horarios[slot % horarios.length];
      redes.forEach((rede, i) => {
        const r = vars[(rod * redes.length + i) % vars.length];
        posts.push({ id: `${dia}-${hora}-${rede}-${corteId}`, dia, hora, rede, corteId, renderId: r.id, variacao: r.variacao, titulo: limpa(r.titulo), template: r.template, ...legenda(r, rede, cfg) });
      });
      slot++;
    }
  }
  return posts;
}

const icsEsc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const fold = (line) => {
  const enc = new TextEncoder();
  const out = [];
  let cur = "";
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
    }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
};

export function ics(posts, cfg, nomeArquivo) {
  const fuso = cfg.fuso || "America/Sao_Paulo";
  const lembrete = Number(cfg.lembrete || 10);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const grupos = new Map();
  for (const p of posts) {
    const k = `${p.dia} ${p.hora}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(p);
  }
  const ev = [];
  for (const [k, ps] of grupos) {
    const [d, h] = k.split(" ");
    const [hh, mm] = h.split(":").map(Number);
    const fimMin = Math.min(hh * 60 + mm + 15, 23 * 60 + 59);
    const dt = d.replace(/-/g, "") + "T" + h.replace(":", "") + "00";
    const fim = d.replace(/-/g, "") + "T" + String(Math.floor(fimMin / 60)).padStart(2, "0") + String(fimMin % 60).padStart(2, "0") + "00";
    const desc = ps.map((p) => `${REDES[p.rede] ?? p.rede} → ${nomeArquivo(p)}\n${p.tituloYt ? "Título: " + p.tituloYt + "\n" : ""}${p.texto}`).join("\n\n---\n\n");
    ev.push(
      ["BEGIN:VEVENT", `UID:${k.replace(/\W/g, "")}-${ps[0].corteId}@cortes.phillcassiano.com`, `DTSTAMP:${stamp}`, `DTSTART;TZID=${fuso}:${dt}`, `DTEND;TZID=${fuso}:${fim}`,
        fold(`SUMMARY:${icsEsc(`Postar: ${ps[0].titulo}`)}`), fold(`DESCRIPTION:${icsEsc(desc)}`),
        "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Hora de postar", `TRIGGER:-PT${lembrete}M`, "END:VALARM", "END:VEVENT"].join("\r\n"),
    );
  }
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//cortes.phillcassiano.com//agenda//PT", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${icsEsc("Cortes " + (cfg.handle || ""))}`, ...ev, "END:VCALENDAR"].join("\r\n");
}

export function csv(posts, nomeArquivo) {
  const e = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return ["data,hora,rede,arquivo,titulo_youtube,legenda", ...posts.map((p) => [p.dia, p.hora, p.rede, nomeArquivo(p), p.tituloYt ?? "", p.texto].map(e).join(","))].join("\n");
}
