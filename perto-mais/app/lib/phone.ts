// Telefones brasileiros em E.164 (+55 DDD número).

const DDD = /^[1-9][1-9]$/;

/** Normaliza entrada livre ("(61) 99999-0000", "61999990000", "+55 61 ...") para E.164. */
export function toE164BR(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  if (!DDD.test(ddd)) return null;
  if (number.length === 9 && !number.startsWith('9')) return null;
  if (number.length === 8 && /^[01]/.test(number)) return null;
  return `+55${ddd}${number}`;
}

export function isMobileE164(e164: string): boolean {
  return /^\+55\d{2}9\d{8}$/.test(e164);
}

/** "+5561955550101" → "(61) 95555-0101" */
export function formatPhoneBR(e164: string | null | undefined): string {
  if (!e164) return '';
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  if (!m) return e164;
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}
