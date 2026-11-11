// Simulador do cálculo de frete do Melhor Envio, para testar sem conta.
// Uso: node dev/mock-melhorenvio.js  (porta 3999) e MELHOR_ENVIO_BASE=http://localhost:3999 no servidor.
// Aceita qualquer token que comece com "teste"; o preço cresce com o peso total.
const http = require("http");
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    res.setHeader("content-type", "application/json");
    if (req.url !== "/api/v2/me/shipment/calculate" || req.method !== "POST") { res.statusCode = 404; return res.end("{}"); }
    if (!/^Bearer teste/.test(req.headers.authorization || "")) { res.statusCode = 401; return res.end(JSON.stringify({ message: "Unauthenticated." })); }
    const b = JSON.parse(body || "{}");
    const kg = (b.products || []).reduce((a, p) => a + p.weight * p.quantity, 0);
    const far = String(b.to.postal_code)[0] !== String(b.from.postal_code)[0];
    const mk = (id, name, company, base, perKg, d) => {
      const v = (base + perKg * kg + (far ? 8 : 0)).toFixed(2);
      return { id, name, price: v, custom_price: v, discount: "0.00", currency: "R$", delivery_time: d + (far ? 3 : 0), custom_delivery_time: d + (far ? 3 : 0),
        delivery_range: { min: d - 1 + (far ? 3 : 0), max: d + (far ? 3 : 0) }, custom_delivery_range: { min: d - 1 + (far ? 3 : 0), max: d + (far ? 3 : 0) }, company: { id: 1, name: company, picture: "" } };
    };
    res.end(JSON.stringify([
      mk(1, "PAC", "Correios", 18.9, 4, 7),
      mk(2, "SEDEX", "Correios", 29.5, 7, 3),
      mk(3, ".Package", "Jadlog", 21.4, 3.5, 6),
      { id: 17, name: "Mini Envios", company: { id: 1, name: "Correios" }, error: "Dimensões do objeto ultrapassam o limite da transportadora." },
    ]));
  });
}).listen(3999, () => console.log("mock Melhor Envio em http://localhost:3999"));
