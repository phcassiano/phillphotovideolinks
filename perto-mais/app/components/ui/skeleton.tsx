import { cn } from '~/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-xl bg-cream-200', className)} />;
}

export function Spinner({ className, label = 'Carregando' }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2', className)}>
      <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
