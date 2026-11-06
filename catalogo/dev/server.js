// Servidor local que imita o Vercel (arquivos + /api + rewrites do vercel.json).
// Uso: REDIS_URL=redis://127.0.0.1:6379 CATALOGO_ADMIN_KEY=chave-de-teste node dev/server.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const api = (name) => require(path.join(root, "api", name + ".js"));
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");
  let p = u.pathname;
  const m = /^\/api\/img\/([^/]+)$/.exec(p);
  if (m) { req.url = "/api/img?id=" + m[1]; return api("img")(req, res); }
  const a = /^\/api\/([a-z]+)$/.exec(p);
  if (a && fs.existsSync(path.join(root, "api", a[1] + ".js"))) return api(a[1])(req, res);
  if (p === "/") p = "/index.html";
  if (p === "/admin") p = "/admin.html";
  if (p === "/painel") p = "/painel.html";
  let f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, "loja.html");
  res.setHeader("content-type", types[path.extname(f)] || "application/octet-stream");
  fs.createReadStream(f).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log("http://localhost:" + (process.env.PORT || 3000)));
