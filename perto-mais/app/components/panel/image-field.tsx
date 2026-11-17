import { useMutation } from '@tanstack/react-query';
import { ImagePlus, Lock, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router';
import { Button, buttonVariants } from '~/components/ui/button';
import { Spinner } from '~/components/ui/skeleton';
import { useToast } from '~/components/ui/toast';
import { dbErrorMessage } from '~/features/panel/queries';
import { removeImage, uploadImage } from '~/features/panel/upload';
import { IMAGE_RULES, mediaUrl, type ImageKind } from '~/lib/images';
import { usePublicEnv, useSupabase } from '~/lib/supabase/client';
import { cn } from '~/lib/utils';

export function errorText(e: unknown) {
  return e instanceof Error && !('code' in e) ? e.message : dbErrorMessage(e);
}

/** Seleção de arquivo com compressão WebP, prévia e estados. */
export function ImagePicker({
  label,
  kind,
  businessId,
  currentPath,
  locked,
  onUploaded,
  onRemove,
  aspect = 'square',
}: {
  label: string;
  kind: ImageKind;
  businessId: string;
  currentPath: string | null;
  locked?: boolean;
  onUploaded: (path: string) => Promise<void>;
  onRemove?: () => Promise<void>;
  aspect?: 'square' | 'wide';
}) {
  const env = usePublicEnv();
  const supabase = useSupabase();
  const toast = useToast();
  const input = React.useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const path = await uploadImage(supabase, businessId, kind, file);
      try {
        await onUploaded(path);
      } catch (e) {
        await removeImage(supabase, path);
        throw e;
      }
    },
    onSuccess: () => toast({ tone: 'success', message: 'Imagem salva.' }),
    onError: (e) => toast({ tone: 'error', message: errorText(e) }),
  });
  const remove = useMutation({
    mutationFn: async () => onRemove?.(),
    onSuccess: () => toast({ tone: 'success', message: 'Imagem removida.' }),
    onError: (e) => toast({ tone: 'error', message: errorText(e) }),
  });
  const url = mediaUrl(env.SUPABASE_URL, currentPath);
  const busy = upload.isPending || remove.isPending;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <div
        className={cn(
          'relative grid place-items-center overflow-hidden rounded-2xl bg-cream-200 ring-1 ring-line',
          aspect === 'square' ? 'size-32' : 'aspect-[5/2] w-full max-w-md',
        )}
      >
        {url ? <img src={url} alt="" className="size-full object-cover" /> : <ImagePlus aria-hidden className="size-8 text-ink-muted" />}
        {busy ? (
          <div className="absolute inset-0 grid place-items-center bg-white/70">
            <Spinner label="Enviando" className="text-brand-700" />
          </div>
        ) : null}
      </div>
      {locked ? (
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
          <Lock aria-hidden className="size-4" /> Disponível no plano Vitrine.
          <Link to="/painel/assinatura" className="font-semibold text-brand-700">
            Ver plano
          </Link>
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept={IMAGE_RULES.acceptedTypes.join(',')}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            onClick={() => input.current?.click()}
            disabled={busy}
            aria-label={`${url ? 'Trocar' : 'Enviar'} ${label.toLowerCase()}`}
          >
            <ImagePlus aria-hidden /> {url ? 'Trocar' : 'Enviar'}
          </button>
          {url && onRemove ? (
            <Button variant="ghost" size="sm" onClick={() => remove.mutate()} disabled={busy} aria-label={`Remover ${label.toLowerCase()}`}>
              <Trash2 aria-hidden /> Remover
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
