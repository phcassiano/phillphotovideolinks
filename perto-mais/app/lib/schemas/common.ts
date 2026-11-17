import { z } from 'zod';
import { toE164BR } from '~/lib/phone';

export const phoneBR = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Informe o ${label}.`)
    .refine((v) => toE164BR(v) !== null, `${label[0]!.toUpperCase()}${label.slice(1)} inválido. Use DDD + número.`)
    .transform((v) => toE164BR(v)!);

export const optionalPhoneBR = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || toE164BR(v) !== null, `${label[0]!.toUpperCase()}${label.slice(1)} inválido. Use DDD + número.`)
    .transform((v) => (v === '' ? null : toE164BR(v)));

export const optionalText = (max: number, msg?: string) =>
  z
    .string()
    .trim()
    .max(max, msg ?? `Use no máximo ${max} caracteres.`)
    .transform((v) => (v === '' ? null : v));

export const coord = (min: number, max: number) =>
  z.union([z.literal(''), z.coerce.number().min(min).max(max)]).transform((v) => (v === '' ? null : v));

export const uuidField = (msg: string) => z.string().uuid(msg);

export const email = z.string().trim().toLowerCase().email('E-mail inválido.').max(254);
export const password = z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(72, 'Senha muito longa.');

/** Converte FormData em objeto simples (para revalidar no servidor com o mesmo schema). */
export function formToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === 'string') out[k] = v;
  return out;
}

/** Mapa campo → primeira mensagem de erro. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
