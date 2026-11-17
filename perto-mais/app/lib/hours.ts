export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

export type HourRow = { weekday: number; opens_at: string; closes_at: string };

export const trimTime = (t: string) => t.slice(0, 5);

/** Agrupa intervalos por dia, na ordem de segunda a domingo. */
export function groupHours(rows: HourRow[]) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((weekday) => ({
    weekday,
    label: WEEKDAYS[weekday]!,
    intervals: rows
      .filter((r) => r.weekday === weekday)
      .sort((a, b) => a.opens_at.localeCompare(b.opens_at))
      .map((r) => `${trimTime(r.opens_at)}–${trimTime(r.closes_at)}`),
  }));
}

/**
 * Espelho de public.is_open_at para uso no cliente/testes.
 * `now` deve estar no fuso local do estabelecimento (dia da semana e HH:MM).
 */
export function isOpenAt(rows: HourRow[], weekday: number, time: string): boolean | null {
  if (rows.length === 0) return null;
  const t = time.slice(0, 5);
  const prev = (weekday + 6) % 7;
  return rows.some((r) => {
    const o = trimTime(r.opens_at);
    const c = trimTime(r.closes_at);
    const overnight = c < o;
    if (r.weekday === weekday) {
      return overnight ? t >= o : t >= o && t < c;
    }
    return r.weekday === prev && overnight && t < c;
  });
}

/** Dia da semana e hora atuais em um fuso. */
export function nowInZone(timeZone = 'America/Sao_Paulo', date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const hour = get('hour') === '24' ? '00' : get('hour');
  return { weekday, time: `${hour}:${get('minute')}` };
}
