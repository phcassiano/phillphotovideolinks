import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { errorText } from './image-field';
import { Alert } from '~/components/ui/alert';
import { Button, buttonVariants } from '~/components/ui/button';
import { Skeleton, Spinner } from '~/components/ui/skeleton';
import { useToast } from '~/components/ui/toast';
import { panelKeys } from '~/features/panel/queries';
import { removeImage, uploadImage } from '~/features/panel/upload';
import { IMAGE_RULES, mediaUrl } from '~/lib/images';
import { usePublicEnv, useSupabase } from '~/lib/supabase/client';

export function GalleryManager({ businessId, maxPhotos }: { businessId: string; maxPhotos: number }) {
  const supabase = useSupabase();
  const env = usePublicEnv();
  const qc = useQueryClient();
  const toast = useToast();
  const input = React.useRef<HTMLInputElement>(null);
  const photos = useQuery({
    queryKey: panelKeys.photos(businessId),
    queryFn: async () => {
      const { data, error } = await supabase.from('business_photos').select('id, path, caption, sort_order').eq('business_id', businessId).order('sort_order');
      if (error) throw error;
      return data;
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: panelKeys.photos(businessId) });
  const add = useMutation({
    mutationFn: async (files: File[]) => {
      let order = (photos.data?.at(-1)?.sort_order ?? 0) + 1;
      for (const file of files) {
        const path = await uploadImage(supabase, businessId, 'gallery', file);
        const { error } = await supabase.from('business_photos').insert({ business_id: businessId, path, sort_order: order++ });
        if (error) {
          await removeImage(supabase, path);
          throw error;
        }
      }
    },
    onSuccess: () => toast({ tone: 'success', message: 'Fotos adicionadas.' }),
    onError: (e) => toast({ tone: 'error', message: errorText(e) }),
    onSettled: invalidate,
  });
  const del = useMutation({
    mutationFn: async (p: { id: string; path: string }) => {
      const { error } = await supabase.from('business_photos').delete().eq('id', p.id);
      if (error) throw error;
      await removeImage(supabase, p.path);
    },
    onSuccess: () => toast({ tone: 'success', message: 'Foto removida.' }),
    onError: (e) => toast({ tone: 'error', message: errorText(e) }),
    onSettled: invalidate,
  });

  if (photos.isLoading) return <Skeleton className="h-40" />;
  if (photos.isError) return <Alert tone="error">Não foi possível carregar as fotos.</Alert>;
  const list = photos.data ?? [];
  const full = list.length >= maxPhotos;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">
        {list.length} de {maxPhotos} fotos.
      </p>
      {list.length === 0 ? <p className="rounded-2xl bg-cream p-4 text-sm text-ink-muted">Nenhuma foto ainda. Mostre o ambiente, a fachada e seus produtos.</p> : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {list.map((p) => (
          <li key={p.id} className="relative overflow-hidden rounded-2xl ring-1 ring-line">
            <img src={mediaUrl(env.SUPABASE_URL, p.path) ?? ''} alt={p.caption ?? 'Foto da galeria'} className="aspect-[4/3] w-full object-cover" loading="lazy" />
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-2 top-2 shadow"
              aria-label="Remover foto"
              onClick={() => del.mutate({ id: p.id, path: p.path })}
              disabled={del.isPending}
            >
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <input
        ref={input}
        type="file"
        multiple
        accept={IMAGE_RULES.acceptedTypes.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).slice(0, Math.max(0, maxPhotos - list.length));
          if (files.length) add.mutate(files);
          e.target.value = '';
        }}
      />
      <button type="button" className={buttonVariants({ variant: 'secondary', className: 'self-start' })} disabled={full || add.isPending} onClick={() => input.current?.click()}>
        {add.isPending ? <Spinner label="Enviando" /> : <ImagePlus aria-hidden />} {full ? 'Limite de fotos atingido' : 'Adicionar fotos'}
      </button>
    </div>
  );
}
