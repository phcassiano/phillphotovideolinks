import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useToast } from '~/components/ui/toast';
import { dbErrorMessage } from '~/features/panel/queries';

/** Mutação com toast de sucesso/erro e invalidação das chaves informadas. */
export function useAdminMutation<TArgs>(
  fn: (args: TArgs) => Promise<unknown>,
  { success, invalidate = [] }: { success?: string; invalidate?: QueryKey[] } = {},
) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (args: TArgs) => {
      const res = await fn(args);
      const err = (res as { error?: unknown } | undefined)?.error;
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      if (success) toast({ tone: 'success', message: success });
    },
    onError: (e) => toast({ tone: 'error', message: e instanceof Error && !('code' in e) ? e.message : dbErrorMessage(e) }),
    onSettled: () => {
      for (const key of invalidate) qc.invalidateQueries({ queryKey: key });
    },
  });
}

export const dateBR = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');
export const dateTimeBR = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
export const toDateInput = (d: Date) => d.toISOString().slice(0, 10);
