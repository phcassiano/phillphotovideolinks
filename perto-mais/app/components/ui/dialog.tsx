import { Dialog as D } from 'radix-ui';
import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '~/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  side = 'center',
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  side?: 'center' | 'bottom';
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-[2px] data-[state=open]:animate-[fade-up_.2s_ease-out]" />
      <D.Content
        className={cn(
          'fixed z-50 flex max-h-[92dvh] w-full flex-col bg-cream shadow-[var(--shadow-lift)] focus:outline-none',
          side === 'bottom'
            ? 'inset-x-0 bottom-0 rounded-t-3xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl'
            : 'left-1/2 top-1/2 max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl',
          'data-[state=open]:animate-[fade-up_.25s_ease-out]',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div>
            <D.Title className="text-lg font-bold">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-sm text-ink-muted">{description}</D.Description> : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close className="-mr-2 -mt-1 grid size-11 place-items-center rounded-full hover:bg-cream-200" aria-label="Fechar">
            <X className="size-5" />
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
