// Web Push sem dependências: VAPID (RFC 8292) + criptografia aes128gcm (RFC 8291).
// O arquivo começa com "_" para o Vercel não transformá-lo numa rota.
const crypto = require("crypto");

const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

// Serviços de push conhecidos (evita usar o servidor para chamar endereços quaisquer).
const PUSH_HOST = /(^|\.)(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/i;
function validSub(sub) {
  if (!sub || typeof sub !== "object" || !sub.keys) return false;
  let u; try { u = new URL(String(sub.endpoint)); } catch { return false; }
  if (u.protocol !== "https:" || !PUSH_HOST.test(u.hostname)) return false;
  const p = unb64u(sub.keys.p256dh || ""), a = unb64u(sub.keys.auth || "");
  return p.length === 65 && p[0] === 4 && a.length >= 16 && String(sub.endpoint).length < 1000;
}

function newVapid() {
  const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = privateKey.export({ format: "jwk" });
  return { kty: "EC", crv: "P-256", d: jwk.d, x: jwk.x, y: jwk.y };
}
const vapidPublic = (jwk) => b64u(Buffer.concat([Buffer.from([4]), unb64u(jwk.x), unb64u(jwk.y)]));

function vapidAuth(jwk, endpoint, subject) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const key = crypto.createPrivateKey({ key: jwk, format: "jwk" });
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${vapidPublic(jwk)}`;
}

const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();

// Cifra a mensagem para um aparelho (um único registro, rs = 4096).
function encrypt(sub, payload) {
  const uaPublic = unb64u(sub.keys.p256dh), authSecret = unb64u(sub.keys.auth);
  const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(uaPublic);
  const prkKey = hmac(authSecret, secret);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]));
  const salt = crypto.randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);
  const c = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, ct]);
}

async function send(sub, payload, jwk, subject) {
  const r = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidAuth(jwk, sub.endpoint, subject),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body: encrypt(sub, payload),
  });
  return r.status;
}

module.exports = { validSub, newVapid, vapidPublic, vapidAuth, encrypt, send, b64u, unb64u };
