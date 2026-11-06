// Entrega as imagens dos catálogos: GET /api/img/<id> (o id muda a cada envio, então o cache é longo).
const db = require("./_db.js");

module.exports = async (req, res) => {
  const url = new URL(req.url, "http://x");
  const id = String(url.searchParams.get("id") || url.pathname.split("/").pop() || "").replace(/\.\w+$/, "");
  if (!db.IMG_RE.test(id)) { res.statusCode = 404; return res.end(); }
  const st = db.storage();
  if (!st) { res.statusCode = 503; return res.end(); }
  try {
    const [raw] = await db.redis(st, ["GET", db.K.img(id)]);
    if (!raw) { res.statusCode = 404; res.setHeader("cache-control", "public, max-age=60"); return res.end(); }
    const i = raw.indexOf(";");
    const mime = raw.slice(0, i);
    res.statusCode = 200;
    res.setHeader("content-type", /^image\/(webp|jpeg|png)$/.test(mime) ? mime : "application/octet-stream");
    res.setHeader("cache-control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(Buffer.from(raw.slice(i + 1), "base64"));
  } catch (e) {
    console.error(e);
    res.statusCode = 500; res.end();
  }
};
