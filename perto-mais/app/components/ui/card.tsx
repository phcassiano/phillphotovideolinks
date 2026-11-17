import * as React from 'react';
import { cn } from '~/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-card)]', className)} {...props} />;
}
