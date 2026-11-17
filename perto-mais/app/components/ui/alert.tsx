import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import * as React from 'react';
import { cn } from '~/lib/utils';

const styles = {
  info: { box: 'bg-white ring-1 ring-line', icon: Info, color: 'text-brand-700' },
  success: { box: 'bg-[#e3f4e8]', icon: CheckCircle2, color: 'text-success' },
  warning: { box: 'bg-warning-50', icon: TriangleAlert, color: 'text-warning' },
  error: { box: 'bg-danger-50', icon: AlertCircle, color: 'text-danger' },
} as const;

export function Alert({
  tone = 'info',
  title,
  children,
  className,
  action,
}: {
  tone?: keyof typeof styles;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const s = styles[tone];
  const Icon = s.icon;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-2xl p-4', s.box, className)}>
      <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', s.color)} />
      <div className="min-w-0 flex-1 text-sm">
        {title ? <p className="font-semibold text-ink">{title}</p> : null}
        {children ? <div className="mt-0.5 text-ink-muted [&_a]:font-semibold [&_a]:text-brand-700">{children}</div> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
