// Chaves canceladas (reembolso, estorno, cancelamento manual). O app baixa uma vez por dia.
const lib = require("./_lib");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=300");
  try {
    const ids = await lib.db("revela_revoked", {});
    return res.status(200).json({ ids: ids || [] });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ ids: [] });
  }
};
