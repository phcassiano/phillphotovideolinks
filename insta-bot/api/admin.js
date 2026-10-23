// API do painel: POST /api/admin com {op, senha, ...}. A senha é a variável ADMIN_PASSWORD do Vercel.
const ig = require("./_ig.js");
const ai = require("./_ai.js");
const { redis } = ig;

const clientIp = (req) => String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
const failKey = (ip) => `ib:fail:${ip}`;
const MAX_FAILS = 10;

function passwordOk(given) {
  const want = process.env.ADMIN_PASSWORD || "";
  return want.length >= 10 && ig.sameHash(ig.sha(String(given || "")), ig.sha(want));
}
const parse = (raw) => { try { return JSON.parse(raw); } catch { return null; } };

const ops = {
  async status(st) {
    const env = {
      IG_ACCESS_TOKEN: !!process.env.IG_ACCESS_TOKEN, IG_APP_SECRET: !!process.env.IG_APP_SECRET,
      IG_VERIFY_TOKEN: !!process.env.IG_VERIFY_TOKEN, CRON_SECRET: !!process.env.CRON_SECRET,
      ANTHROPIC_API_KEY: ai.ready(),
    };
    const day = new Date().toISOString().slice(0, 10);
    const [tok, stats, today] = await redis(st, ["GET", "ib:token"], ["HGETALL", "ib:stats"], ["HGETALL", `ib:stats:${day}`]);
    const toObj = (a) => { if (!Array.isArray(a)) return a || {}; const o = {}; for (let i = 0; i < a.length; i += 2) o[a[i]] = Number(a[i + 1]); return o; };
    let account = null, accountError = null;
    try { account = await ig.me(st); } catch (e) { accountError = e.message; }
    return { env, account, accountError, token: parse(tok) ? { refreshedAt: parse(tok).refreshedAt, expiresAt: parse(tok).expiresAt } : null, stats: toObj(stats), today: toObj(today), version: ig.VERSION };
  },
  async rules(st) { return { rules: await ig.getRules(st) }; },
  async saveRules(st, b) { return { rules: await ig.saveRules(st, b.rules) }; },
  async log(st) {
    const [items] = await redis(st, ["LRANGE", "ib:log", "0", "199"]);
    return { items: (items || []).map(parse).filter(Boolean) };
  },
  async clearLog(st) { await redis(st, ["DEL", "ib:log"]); return { ok: true }; },

  // Posts e comentários
  async media(st, b) {
    const query = { fields: "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,comments_count,like_count", limit: "24" };
    if (b.after) query.after = String(b.after);
    const j = await ig.graph(st, "GET", "me/media", { query });
    return { items: j.data || [], after: (j.paging && j.paging.next && j.paging.cursors && j.paging.cursors.after) || null };
  },
  async comments(st, b) {
    if (!/^\d+$/.test(String(b.mediaId || ""))) throw new Error("Post inválido.");
    const j = await ig.graph(st, "GET", `${b.mediaId}/comments`, { query: { fields: "id,text,username,timestamp,hidden,like_count,replies{id,text,username,timestamp}", limit: "50" } });
    return { items: j.data || [] };
  },
  async reply(st, b) {
    const text = String(b.text || "").trim().slice(0, 2200);
    if (!/^\d+$/.test(String(b.commentId || "")) || !text) throw new Error("Escreva a resposta.");
    const j = await ig.replyComment(st, b.commentId, text);
    await ig.log(st, { type: "manual_reply", commentId: b.commentId, text: text.slice(0, 300) });
    return { id: j.id };
  },
  async privateReply(st, b) {
    const text = String(b.text || "").trim().slice(0, 1000);
    if (!/^\d+$/.test(String(b.commentId || "")) || !text) throw new Error("Escreva a mensagem.");
    await ig.sendDm(st, { comment_id: String(b.commentId) }, text);
    await ig.log(st, { type: "manual_dm", commentId: b.commentId, text: text.slice(0, 300) });
    return { ok: true };
  },
  async hide(st, b) {
    if (!/^\d+$/.test(String(b.commentId || ""))) throw new Error("Comentário inválido.");
    await ig.hideComment(st, b.commentId, b.hide !== false);
    return { ok: true };
  },
  async remove(st, b) {
    if (!/^\d+$/.test(String(b.commentId || ""))) throw new Error("Comentário inválido.");
    await ig.deleteComment(st, b.commentId);
    return { ok: true };
  },

  // Direct
  async threads(st) {
    const [ids] = await redis(st, ["ZREVRANGE", "ib:threads", "0", "99", "WITHSCORES"]);
    const list = [];
    for (let i = 0; i < (ids || []).length; i += 2) list.push({ igsid: ids[i], t: Number(ids[i + 1]) });
    if (!list.length) return { items: [] };
    const who = await redis(st, ...list.map((x) => ["HGETALL", `ib:who:${x.igsid}`]));
    return {
      items: list.map((x, i) => {
        const a = who[i] || []; const o = {};
        if (Array.isArray(a)) for (let k = 0; k < a.length; k += 2) o[a[k]] = a[k + 1]; else Object.assign(o, a);
        return { ...x, username: o.username || "", last: o.last || "", lastFrom: o.lastFrom || "", lastUserAt: Number(o.lastUserAt || 0), unread: Number(o.unread || 0), human: o.human === "1" };
      }),
    };
  },
  async thread(st, b) {
    const id = String(b.igsid || "");
    if (!/^\d+$/.test(id)) throw new Error("Conversa inválida.");
    const [items] = await redis(st, ["LRANGE", `ib:thread:${id}`, "0", "99"], ["HSET", `ib:who:${id}`, "unread", "0"]);
    return { items: (items || []).map(parse).filter(Boolean).reverse() };
  },
  async send(st, b) {
    const id = String(b.igsid || ""), text = String(b.text || "").trim().slice(0, 1000);
    if (!/^\d+$/.test(id) || !text) throw new Error("Escreva a mensagem.");
    const j = await ig.sendDm(st, { id }, text);
    // O eco da Meta também chega pelo webhook; marcar o mid evita a mensagem aparecer duas vezes.
    if (j.message_id) await redis(st, ["SET", `ib:seen:m:${j.message_id}`, "1", "EX", String(7 * 86400)]);
    await ig.saveMsg(st, id, { from: "me", text, mid: j.message_id });
    // Você assumiu a conversa: a IA fica quieta com essa pessoa por 24 h.
    await redis(st, ["SET", `ib:ai:pause:${id}`, "1", "EX", "86400"], ["HDEL", `ib:who:${id}`, "human"]);
    return { ok: true };
  },

  // Pedido de exclusão (LGPD): some a conversa e o nome guardado dessa pessoa.
  async forget(st, b) {
    const id = String(b.igsid || "");
    if (!/^\d+$/.test(id)) throw new Error("Conversa inválida.");
    await redis(st, ["DEL", `ib:thread:${id}`], ["DEL", `ib:who:${id}`], ["ZREM", "ib:threads", id]);
    return { ok: true };
  },

  // IA
  async ai(st) { return { settings: await ai.getSettings(st), ready: ai.ready(), model: ai.MODEL }; },
  async saveAi(st, b) { return { settings: await ai.saveSettings(st, b.settings || {}) }; },
  async aiTest(st, b) {
    if (!ai.ready()) throw new Error("Falta configurar ANTHROPIC_API_KEY no Vercel.");
    const text = String(b.text || "").trim().slice(0, 1000);
    if (!text) throw new Error("Escreva uma mensagem de teste.");
    const settings = { ...(await ai.getSettings(st)), ...(b.settings ? { about: String(b.settings.about || "").slice(0, 8000) } : {}) };
    let account = "voce"; try { account = (await ig.me(st)).username; } catch {}
    const kind = b.kind === "comment" ? "comment" : "dm";
    return await ai.ask(settings, account, kind, [{ from: "user", text }], "seguidor_teste");
  },
  async aiResume(st, b) {
    const id = String(b.igsid || "");
    if (!/^\d+$/.test(id)) throw new Error("Conversa inválida.");
    await redis(st, ["DEL", `ib:ai:pause:${id}`], ["HDEL", `ib:who:${id}`, "human"]);
    return { ok: true };
  },

  async refreshToken(st) { return { token: await ig.refreshToken(st) }; },
};

module.exports = async (req, res) => {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  let body = req.body || {};
  if (typeof body === "string") body = parse(body || "{}") || {};
  const st = ig.storage();
  if (!st) return res.status(503).json({ error: "Falta conectar um banco Redis (aba Storage do Vercel)." });
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 10) return res.status(503).json({ error: "Falta configurar ADMIN_PASSWORD (mínimo 10 caracteres) no Vercel." });

  const ip = clientIp(req);
  try {
    const [fails] = await redis(st, ["GET", failKey(ip)]);
    if (Number(fails || 0) >= MAX_FAILS) return res.status(429).json({ error: "Muitas tentativas. Tente de novo em 1 hora." });
    if (!passwordOk(body.senha)) {
      await redis(st, ["INCR", failKey(ip)], ["EXPIRE", failKey(ip), "3600"]);
      return res.status(401).json({ error: "Senha errada." });
    }
    const fn = ops[body.op];
    if (!fn) return res.status(400).json({ error: "Operação desconhecida." });
    return res.status(200).json(await fn(st, body));
  } catch (e) {
    return res.status(502).json({ error: e.message || "Erro" });
  }
};
