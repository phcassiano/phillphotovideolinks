import { Clock, MapPin, Star } from 'lucide-react';
import { Link } from 'react-router';
import { CategoryIcon } from '~/components/category-icon';
import { CallButton, WhatsAppButton } from '~/components/contact-buttons';
import { Badge } from '~/components/ui/badge';
import { buttonVariants } from '~/components/ui/button';
import type { PublicBusiness } from '~/features/business/types';
import { formatDistance } from '~/lib/geo';
import { mediaUrl } from '~/lib/images';
import { cn } from '~/lib/utils';
import { usePublicEnv } from '~/lib/public-env';

export function BusinessCard({ business: b, priority = false }: { business: PublicBusiness; priority?: boolean }) {
  const env = usePublicEnv();
  const image = mediaUrl(env.SUPABASE_URL, b.logo_path);
  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-lift)]',
        b.is_highlighted && 'ring-2 ring-accent',
      )}
    >
      <div className="flex gap-3 p-4">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-brand-50">
          {image ? (
            <img
              src={image}
              alt=""
              width={64}
              height={64}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              className="size-full object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center text-brand-700">
              <CategoryIcon name={b.category_icon} className="size-7" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {b.is_featured ? (
              <Badge variant="featured">
                <Star aria-hidden /> Destaque
              </Badge>
            ) : null}
            {b.is_demo ? <Badge variant="demo">Demonstração</Badge> : null}
          </div>
          <h3 className="mt-1 text-[1.05rem] font-bold leading-snug">
            <Link to={`/estabelecimento/${b.slug}`} className="hover:text-brand-700">
              {b.name}
            </Link>
          </h3>
          <p className="text-sm text-ink-muted">{b.category_name}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 px-4 pb-3 text-sm text-ink-muted">
        <p className="flex items-start gap-1.5">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            {b.address_line} · {b.neighborhood_name}
            {b.distance_km != null ? <strong className="font-semibold text-ink"> · {formatDistance(b.distance_km)}</strong> : null}
          </span>
        </p>
        {b.is_open_now != null ? (
          <p className="flex items-center gap-1.5">
            <Clock aria-hidden className="size-4 shrink-0" />
            <Badge variant={b.is_open_now ? 'open' : 'closed'}>{b.is_open_now ? 'Aberto agora' : 'Fechado agora'}</Badge>
          </p>
        ) : null}
      </div>
      <div className="mt-auto grid grid-cols-3 gap-2 border-t border-line p-3">
        <WhatsAppButton business={b} size="sm" className="px-2" />
        <CallButton business={b} size="sm" className="px-2" />
        <Link
          to={`/estabelecimento/${b.slug}`}
          className={buttonVariants({ variant: 'soft', size: 'sm', className: 'px-2' })}
          aria-label={`Ver detalhes de ${b.name}`}
        >
          Detalhes
        </Link>
      </div>
    </article>
  );
}

export function BusinessGrid({ items }: { items: PublicBusiness[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((b, i) => (
        <BusinessCard key={b.id} business={b} priority={i < 3} />
      ))}
    </div>
  );
}
