const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatBRL = (cents: number) => brl.format(cents / 100);

/** "19,90" | "19.90" | "R$ 1.234,50" → centavos */
export function parseBRL(input: string): number | null {
  const clean = input.replace(/[^\d,.-]/g, '').trim();
  if (!clean) return null;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
