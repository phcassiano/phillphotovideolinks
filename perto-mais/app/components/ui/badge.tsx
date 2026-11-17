import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '~/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3.5', {
  variants: {
    variant: {
      neutral: 'bg-cream-200 text-ink',
      brand: 'bg-brand-50 text-brand-700',
      open: 'bg-[#e3f4e8] text-success',
      closed: 'bg-cream-200 text-ink-muted',
      demo: 'bg-[#efe7ff] text-[#5b3cc4]',
      warning: 'bg-warning-50 text-warning',
      danger: 'bg-danger-50 text-danger',
      featured: 'bg-accent text-ink',
    },
  },
  defaultVariants: { variant: 'neutral' },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
