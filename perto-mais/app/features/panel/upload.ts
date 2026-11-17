import { compressToWebp, STORAGE_BUCKET, type ImageKind } from '~/lib/images';
import type { getBrowserSupabase } from '~/lib/supabase/client';

type Client = ReturnType<typeof getBrowserSupabase>;

/** Comprime no navegador, envia como WebP e devolve o caminho no bucket. */
export async function uploadImage(supabase: Client, businessId: string, kind: ImageKind, file: File): Promise<string> {
  const blob = await compressToWebp(file, kind);
  const path = `${businessId}/${kind}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error('Falha no envio da imagem. Tente de novo.');
  return path;
}

/** Remove um arquivo do Storage (ignora imagens estáticas de demonstração). */
export async function removeImage(supabase: Client, path: string | null | undefined) {
  if (!path || path.startsWith('/')) return;
  await supabase.storage.from(STORAGE_BUCKET).remove([path]);
}
