import { Star } from 'lucide-react';
import * as React from 'react';
import { WhatsAppButton } from '~/components/contact-buttons';
import { Badge } from '~/components/ui/badge';
import { Dialog, DialogContent } from '~/components/ui/dialog';
import { track } from '~/features/metrics/track';
import { mediaUrl } from '~/lib/images';
import { formatBRL } from '~/lib/money';
import { usePublicEnv } from '~/lib/public-env';
import { cn } from '~/lib/utils';

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  photo_path: string | null;
  is_available: boolean;
  is_featured: boolean;
  product_category_id: string | null;
};
type Business = { id: string; name: string; whatsapp_e164: string | null; phone_e164: string | null; is_demo: boolean };

export function ProductShowcase({
  business,
  categories,
  products,
  menuLayout,
}: {
  business: Business;
  categories: { id: string; name: string }[];
  products: Product[];
  menuLayout: boolean;
}) {
  const env = usePublicEnv();
  const [open, setOpen] = React.useState<Product | null>(null);
  const groups = [
    ...categories.map((c) => ({ id: c.id, name: c.name, items: products.filter((p) => p.product_category_id === c.id) })),
    { id: 'outros', name: categories.length ? 'Outros' : '', items: products.filter((p) => !p.product_category_id || !categories.some((c) => c.id === p.product_category_id)) },
  ].filter((g) => g.items.length > 0);
  const featured = products.filter((p) => p.is_featured && p.is_available);

  function show(p: Product) {
    setOpen(p);
    track(business.id, 'product_view', p.id);
  }

  const price = (p: Product) => (p.price_cents != null ? formatBRL(p.price_cents) : 'Consulte');

  return (
    <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]" aria-labelledby="vitrine-title">
      <h2 id="vitrine-title" className="text-lg font-bold">
        {menuLayout ? 'Cardápio' : 'Produtos e serviços'}
      </h2>

      {featured.length > 0 && !menuLayout ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant="featured">
            <Star aria-hidden /> Destaques: {featured.map((f) => f.name).join(', ')}
          </Badge>
        </div>
      ) : null}

      {groups.map((g) => (
        <div key={g.id} className="mt-5">
          {g.name ? <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">{g.name}</h3> : null}
          {menuLayout ? (
            <ul className="divide-y divide-dashed divide-line">
              {g.items.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => show(p)}
                    className={cn('flex w-full items-start gap-3 py-3 text-left', !p.is_available && 'opacity-60')}
                  >
                    {p.photo_path ? (
                      <img
                        src={mediaUrl(env.SUPABASE_URL, p.photo_path) ?? ''}
                        alt=""
                        loading="lazy"
                        className="size-16 shrink-0 rounded-xl object-cover"
                      />
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-semibold">
                        {p.name}
                        {p.is_featured ? <Star aria-label="Destaque" className="size-4 fill-accent text-accent" /> : null}
                      </span>
                      {p.description ? <span className="mt-0.5 line-clamp-2 block text-sm text-ink-muted">{p.description}</span> : null}
                      {!p.is_available ? <span className="mt-1 block text-xs font-semibold text-danger">Indisponível no momento</span> : null}
                    </span>
                    <span className="shrink-0 font-bold text-brand-700">{price(p)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {g.items.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => show(p)}
                    className={cn(
                      'flex h-full w-full flex-col overflow-hidden rounded-2xl text-left ring-1 ring-line transition hover:shadow-[var(--shadow-card)]',
                      !p.is_available && 'opacity-60',
                    )}
                  >
                    <span className="block aspect-square w-full bg-cream-200">
                      {p.photo_path ? (
                        <img src={mediaUrl(env.SUPABASE_URL, p.photo_path) ?? ''} alt="" loading="lazy" className="size-full object-cover" />
                      ) : null}
                    </span>
                    <span className="flex flex-1 flex-col gap-0.5 p-3">
                      <span className="text-sm font-semibold leading-snug">{p.name}</span>
                      <span className="mt-auto pt-1 font-bold text-brand-700">{price(p)}</span>
                      {!p.is_available ? <span className="text-xs font-semibold text-danger">Indisponível</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        {open ? (
          <DialogContent title={open.name} side="bottom">
            {open.photo_path ? (
              <img src={mediaUrl(env.SUPABASE_URL, open.photo_path) ?? ''} alt={open.name} className="aspect-square w-full rounded-2xl object-cover sm:aspect-[4/3]" />
            ) : null}
            <p className="mt-4 text-2xl font-black text-brand-700">{price(open)}</p>
            {open.description ? <p className="mt-2 text-ink-muted">{open.description}</p> : null}
            {!open.is_available ? <p className="mt-2 font-semibold text-danger">Indisponível no momento</p> : null}
            <WhatsAppButton
              business={business}
              productName={open.name}
              label="Consultar pelo WhatsApp"
              size="lg"
              className="mt-5 w-full"
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}
