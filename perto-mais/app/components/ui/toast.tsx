import * as React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '~/lib/utils';

type Toast = { id: number; tone: 'success' | 'error' | 'info'; message: string };
const ToastContext = React.createContext<(t: Omit<Toast, 'id'>) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const push = React.useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all, { ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-[var(--shadow-lift)] animate-fade-up',
              t.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-white',
            )}
          >
            {t.tone === 'error' ? <AlertCircle className="size-5" /> : <CheckCircle2 className="size-5" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => React.useContext(ToastContext);
