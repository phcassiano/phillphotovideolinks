import { z } from 'zod';
import { coord, email, optionalPhoneBR, optionalText, password, phoneBR, uuidField } from './common';

/** Campos do estabelecimento editáveis pelo comerciante (plano gratuito). */
export const businessBaseShape = {
  name: z.string().trim().min(2, 'Informe o nome do negócio.').max(120),
  categoryId: uuidField('Escolha a categoria.'),
  cityId: uuidField('Escolha a cidade.'),
  neighborhoodId: uuidField('Escolha o bairro.'),
  addressLine: z.string().trim().min(3, 'Informe o endereço.').max(200),
  addressComplement: optionalText(120),
  postalCode: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{5}-?\d{3}$/.test(v), 'CEP inválido.')
    .transform((v) => (v === '' ? null : v.replace(/^(\d{5})-?(\d{3})$/, '$1-$2'))),
  phone: optionalPhoneBR('telefone'),
  whatsapp: phoneBR('WhatsApp'),
  latitude: coord(-90, 90),
  longitude: coord(-180, 180),
};

export const signupSchema = z
  .object({
    ownerName: z.string().trim().min(2, 'Informe seu nome.').max(120),
    email,
    password,
    ownerPhone: phoneBR('seu telefone'),
    ...businessBaseShape,
    // 'on' vem do FormData; true vem do React Hook Form
    acceptTerms: z.preprocess((v) => v === true || v === 'on', z.literal(true, { error: 'É preciso aceitar os termos.' })),
  })
  .refine((d) => (d.latitude === null) === (d.longitude === null), { path: ['latitude'], message: 'Posição incompleta.' });

export const businessProfileSchema = z
  .object({
    ...businessBaseShape,
    // Campos da Vitrine: o banco recusa se o plano não permitir.
    instagram: z
      .string()
      .trim()
      .transform((v) => v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, ''))
      .refine((v) => v === '' || /^[A-Za-z0-9._]{1,30}$/.test(v), 'Usuário do Instagram inválido.')
      .transform((v) => (v === '' ? null : v)),
    description: optionalText(2000),
    keywords: z
      .string()
      .trim()
      .max(400)
      .transform((v) =>
        v
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
          .slice(0, 20),
      ),
  })
  .refine((d) => (d.latitude === null) === (d.longitude === null), { path: ['latitude'], message: 'Posição incompleta.' });

export type BusinessProfileInput = z.input<typeof businessProfileSchema>;
export type SignupInput = z.input<typeof signupSchema>;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido.');
export const hoursSchema = z
  .array(z.object({ weekday: z.number().int().min(0).max(6), opens_at: time, closes_at: time }))
  .max(28)
  .superRefine((rows, ctx) => {
    rows.forEach((r, i) => {
      if (r.opens_at === r.closes_at) ctx.addIssue({ code: 'custom', path: [i, 'closes_at'], message: 'Abertura e fechamento iguais.' });
    });
    for (let d = 0; d < 7; d++) {
      if (rows.filter((r) => r.weekday === d).length > 4) ctx.addIssue({ code: 'custom', path: [], message: 'No máximo 4 intervalos por dia.' });
    }
  });

export const accountSchema = z.object({
  fullName: z.string().trim().min(2, 'Informe seu nome.').max(120),
  phone: optionalPhoneBR('telefone'),
});
