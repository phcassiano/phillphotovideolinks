export const STORAGE_BUCKET = 'business-media';

/**
 * Resolve um caminho salvo no banco para URL.
 * - "/demo/..." → arquivo estático do repositório (dados de demonstração)
 * - "<business_id>/..." → objeto no Storage público
 */
export function mediaUrl(supabaseUrl: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('/')) return path;
  if (/^https?:\/\//.test(path)) return path;
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

export const IMAGE_RULES = {
  maxInputBytes: 15 * 1024 * 1024,
  maxOutputBytes: 2 * 1024 * 1024,
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
} as const;

export type ImageKind = 'logo' | 'cover' | 'gallery' | 'product';

const DIMENSIONS: Record<ImageKind, number> = { logo: 512, cover: 1600, gallery: 1600, product: 1000 };

/** Comprime e converte para WebP no navegador. */
export async function compressToWebp(file: File, kind: ImageKind): Promise<Blob> {
  if (!IMAGE_RULES.acceptedTypes.includes(file.type as (typeof IMAGE_RULES.acceptedTypes)[number])) {
    throw new Error('Formato não aceito. Envie JPG, PNG ou WebP.');
  }
  if (file.size > IMAGE_RULES.maxInputBytes) {
    throw new Error('Imagem muito grande. O limite é 15 MB.');
  }
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Não foi possível ler esta imagem.');
  });
  const max = DIMENSIONS[kind];
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Seu navegador não permite processar imagens.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  for (const quality of [0.82, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob || blob.type !== 'image/webp') throw new Error('Seu navegador não converte para WebP.');
    if (blob.size <= IMAGE_RULES.maxOutputBytes) return blob;
  }
  throw new Error('Não foi possível reduzir a imagem para menos de 2 MB.');
}
