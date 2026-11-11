// Armazenamento temporário dos vídeos prontos (Vercel Blob), para o Postiz buscar e publicar.
// POST (JSON do @vercel/blob/client): gera o token de envio direto do navegador.
// DELETE ?url=...: apaga o vídeo depois que o Postiz copiou.
import { handleUpload } from "@vercel/blob/client";
import { del } from "@vercel/blob";

const ORIGENS = /^https:\/\/(cortes\.phillcassiano\.com|cortes[a-z0-9-]*\.vercel\.app)(\/|$)|^http:\/\/localhost(:\d+)?(\/|$)/;

async function tratar(req) {
  const quem = req.headers.get("origin") || req.headers.get("referer") || "";
  if (!ORIGENS.test(quem)) return Response.json({ erro: "origem não permitida" }, { status: 403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ erro: "Armazenamento não configurado no projeto (BLOB_READ_WRITE_TOKEN)." }, { status: 500 });

  if (req.method === "DELETE") {
    const url = new URL(req.url).searchParams.get("url") || "";
    if (!/^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/cortes\//.test(url)) return Response.json({ erro: "url inválida" }, { status: 400 });
    await del(url);
    return Response.json({ ok: true });
  }
  if (req.method !== "POST") return Response.json({ erro: "método não permitido" }, { status: 405 });

  const body = await req.json();
  try {
    const r = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("cortes/")) throw new Error("caminho inválido");
        return {
          allowedContentTypes: ["video/mp4", "video/webm"],
          maximumSizeInBytes: 300 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(r);
  } catch (e) {
    return Response.json({ erro: String(e.message || e) }, { status: 400 });
  }
}

export const POST = tratar;
export const DELETE = tratar;
