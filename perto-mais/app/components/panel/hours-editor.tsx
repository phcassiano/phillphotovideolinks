import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Alert } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Skeleton, Spinner } from '~/components/ui/skeleton';
import { useToast } from '~/components/ui/toast';
import { dbErrorMessage, panelKeys, useHours } from '~/features/panel/queries';
import { trimTime, WEEKDAYS } from '~/lib/hours';
import { hoursSchema } from '~/lib/schemas/business';
import { useSupabase } from '~/lib/supabase/client';

type Row = { key: string; weekday: number; opens_at: string; closes_at: string };
const ORDER = [1, 2, 3, 4, 5, 6, 0];
let seq = 0;
const key = () => `h${++seq}`;

export function HoursEditor({ businessId }: { businessId: string }) {
  const hours = useHours(businessId);
  const supabase = useSupabase();
  const qc = useQueryClient();
  const toast = useToast();
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (hours.data && rows === null) {
      setRows(hours.data.map((h) => ({ key: key(), weekday: h.weekday, opens_at: trimTime(h.opens_at), closes_at: trimTime(h.closes_at) })));
    }
  }, [hours.data, rows]);

  const save = useMutation({
    mutationFn: async (list: Row[]) => {
      const parsed = hoursSchema.safeParse(list.map(({ weekday, opens_at, closes_at }) => ({ weekday, opens_at, closes_at })));
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Horários inválidos.');
      const { error: e } = await supabase.rpc('set_business_hours', { p_business_id: businessId, p_hours: parsed.data });
      if (e) throw e;
    },
    onSuccess: () => {
      setError(null);
      toast({ tone: 'success', message: 'Horários salvos.' });
      qc.invalidateQueries({ queryKey: panelKeys.hours(businessId) });
    },
    onError: (e) => setError(e instanceof Error && !('code' in e) ? e.message : dbErrorMessage(e)),
  });

  if (hours.isError) return <Alert tone="error">Não foi possível carregar os horários.</Alert>;
  if (hours.isLoading || rows === null) return <Skeleton className="h-64" />;

  const update = (k: string, patch: Partial<Row>) => setRows((all) => all!.map((r) => (r.key === k ? { ...r, ...patch } : r)));
  const add = (weekday: number) => setRows((all) => [...all!, { key: key(), weekday, opens_at: '08:00', closes_at: '18:00' }]);
  const remove = (k: string) => setRows((all) => all!.filter((r) => r.key !== k));
  const copyToAll = (weekday: number) =>
    setRows((all) => {
      const src = all!.filter((r) => r.weekday === weekday);
      return [...src, ...ORDER.filter((d) => d !== weekday).flatMap((d) => src.map((s) => ({ ...s, key: key(), weekday: d })))];
    });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">
        Dia sem intervalo aparece como “Fechado”. Se atravessa a meia-noite, use fechamento menor que a abertura (ex.: 18:00 às 00:30).
      </p>
      <ul className="divide-y divide-line">
        {ORDER.map((d) => {
          const list = rows.filter((r) => r.weekday === d);
          return (
            <li key={d} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
              <span className="w-24 shrink-0 pt-2.5 font-semibold">{WEEKDAYS[d]}</span>
              <div className="flex flex-1 flex-col gap-2">
                {list.length === 0 ? <span className="pt-2.5 text-sm text-ink-muted">Fechado</span> : null}
                {list.map((r) => (
                  <div key={r.key} className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`${r.key}-o`}>
                      Abre às ({WEEKDAYS[d]})
                    </label>
                    <Input id={`${r.key}-o`} type="time" value={r.opens_at} onChange={(e) => update(r.key, { opens_at: e.target.value })} className="min-w-0 flex-1 px-2 sm:w-32 sm:flex-none sm:px-3.5" />
                    <span aria-hidden>às</span>
                    <label className="sr-only" htmlFor={`${r.key}-c`}>
                      Fecha às ({WEEKDAYS[d]})
                    </label>
                    <Input id={`${r.key}-c`} type="time" value={r.closes_at} onChange={(e) => update(r.key, { closes_at: e.target.value })} className="min-w-0 flex-1 px-2 sm:w-32 sm:flex-none sm:px-3.5" />
                    <Button variant="ghost" size="icon" aria-label={`Remover intervalo de ${WEEKDAYS[d]}`} onClick={() => remove(r.key)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => add(d)} disabled={list.length >= 4}>
                  <Plus aria-hidden /> Intervalo
                </Button>
                {list.length > 0 ? (
                  <Button variant="ghost" size="sm" onClick={() => copyToAll(d)} aria-label={`Copiar horários de ${WEEKDAYS[d]} para todos os dias`}>
                    <Copy aria-hidden /> Todos
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button className="self-start" onClick={() => save.mutate(rows)} disabled={save.isPending}>
        {save.isPending ? <Spinner label="Salvando" /> : null} Salvar horários
      </Button>
    </div>
  );
}
