import { Link } from 'react-router';
import { site } from '~/config/site';
import { cn } from '~/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8', className)}>
      <path d="M16 2C9.9 2 5 6.8 5 12.8 5 21 16 30 16 30s11-9 11-17.2C27 6.8 22.1 2 16 2Z" fill="#E86B19" />
      <path d="M16 8.5v9M11.5 13h9" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-1.5 rounded-lg', className)} aria-label={`${site.name} — início`}>
      <BrandMark />
      <span className="text-xl font-black tracking-tight text-ink">{site.name}</span>
    </Link>
  );
}
