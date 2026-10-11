// Gera capacitor.config.json apontando para o site publicado (SITE_URL).
const fs = require("fs");
const url = String(process.env.SITE_URL || "").trim().replace(/\/+$/, "");
if (!/^https:\/\/[a-z0-9.-]+(\/.*)?$/i.test(url)) { console.error("SITE_URL precisa ser um endereço https://, ex.: https://nos-dois.vercel.app"); process.exit(1); }
const host = new URL(url).hostname;
const cfg = {
  appId: process.env.APP_ID || "app.nosdois.casal",
  appName: "Nós Dois",
  webDir: "www",
  server: { url, cleartext: false, allowNavigation: [host] },
  android: { backgroundColor: "#FBF3F2" }
};
fs.writeFileSync("capacitor.config.json", JSON.stringify(cfg, null, 2));
console.log("capacitor.config.json ->", url);
