import { Check } from 'lucide-react';
import { Link } from 'react-router';
import { buttonVariants } from '~/components/ui/button';
import { formatBRL } from '~/lib/money';
import { cn } from '~/lib/utils';

export type PlanCardData = {
  code: string;
  name: string;
  description: string | null;
  features: string[];
  price_cents: number;
  billing_interval: 'none' | 'month' | 'year';
  is_default: boolean;
};

export function PlanCards({ plans, ctaTo = '/cadastro' }: { plans: PlanCardData[]; ctaTo?: string }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {plans.map((p) => {
        const highlight = !p.is_default;
        return (
          <li
            key={p.code}
            className={cn(
              'flex flex-col rounded-[var(--radius-card)] bg-white p-6 shadow-[var(--shadow-card)]',
              highlight && 'ring-2 ring-brand',
            )}
          >
            <h3 className="text-xl font-black">{p.name}</h3>
            {p.description ? <p className="mt-1 text-ink-muted">{p.description}</p> : null}
            <p className="mt-4">
              <span className="text-4xl font-black tracking-tight">{p.price_cents === 0 ? 'Grátis' : formatBRL(p.price_cents)}</span>
              {p.price_cents > 0 ? (
                <span className="text-ink-muted">/{p.billing_interval === 'year' ? 'ano' : 'mês'}</span>
              ) : null}
            </p>
            <ul className="mt-5 flex flex-1 flex-col gap-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to={ctaTo}
              className={buttonVariants({ variant: highlight ? 'primary' : 'secondary', size: 'lg', className: 'mt-6 w-full' })}
            >
              {p.is_default ? 'Cadastrar grátis' : `Começar e pedir o ${p.name}`}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
