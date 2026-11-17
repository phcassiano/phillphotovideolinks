import { z } from 'zod';
import { parseBRL } from '~/lib/money';
import { optionalText } from './common';

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(120),
  description: optionalText(600),
  price: z
    .string()
    .trim()
    .refine((v) => v === '' || parseBRL(v) !== null, 'Preço inválido.')
    .transform((v) => (v === '' ? null : parseBRL(v))),
  productCategoryId: z.string().transform((v) => (v === '' ? null : v)),
  isAvailable: z.boolean(),
  isFeatured: z.boolean(),
});
export type ProductInput = z.input<typeof productSchema>;

export const productCategorySchema = z.object({ name: z.string().trim().min(1, 'Informe o nome.').max(60) });
