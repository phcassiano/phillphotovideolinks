import { z } from "zod";
import {
  CLAIM_METHODS,
  CONTACT_TYPES,
  CONTACT_VISIBILITIES,
  INTERACTION_TYPES,
  MAILING_VISIBILITIES,
  OUTLET_TYPES,
  PRIVACY_REQUEST_TYPES,
  PROFESSIONAL_STATUSES,
} from "@/lib/domain/enums";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : undefined));

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.url({ protocol: /^https?$/, error: "Informe uma URL iniciada por http(s)://" }).optional());

export const privacyRequestSchema = z.object({
  requestType: z.enum(PRIVACY_REQUEST_TYPES),
  details: z.string().trim().min(10, "Descreva a solicitação (mínimo de 10 caracteres)").max(4000),
  journalistId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  contactEmail: z.email("E-mail inválido").optional().or(z.literal("").transform(() => undefined)),
});

export const mailingSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome à lista").max(120),
  description: optionalText(1000),
  visibility: z.enum(MAILING_VISIBILITIES),
});

export const mailingNotesSchema = z.object({
  mailingId: z.uuid(),
  journalistId: z.uuid(),
  notes: z.string().trim().max(1000),
});

export const interactionSchema = z.object({
  journalistId: z.uuid("Selecione um jornalista"),
  interactionType: z.enum(INTERACTION_TYPES),
  subject: z.string().trim().min(2, "Informe o assunto").max(200),
  notes: optionalText(4000),
  interactionDate: z.iso.date("Data inválida"),
});

export const correctionSchema = z.object({
  journalistId: z.uuid(),
  description: z.string().trim().min(10, "Explique a correção (mínimo de 10 caracteres)").max(4000),
  sourceUrl: optionalUrl,
});

export const claimSchema = z.object({
  journalistId: z.uuid("Selecione o perfil"),
  method: z.enum(CLAIM_METHODS),
  evidenceText: optionalText(2000),
});

export const accountSchema = z.object({
  fullName: z.string().trim().min(3, "Informe seu nome").max(160),
});

export const ownProfileSchema = z.object({
  professionalName: optionalText(160),
  biography: optionalText(2000),
  professionalStatus: z.enum(PROFESSIONAL_STATUSES),
});

export const ownContactSchema = z
  .object({
    contactType: z.enum(CONTACT_TYPES),
    contactValue: z.string().trim().min(3).max(300),
    visibility: z.enum(CONTACT_VISIBILITIES).exclude(["oculto"]),
    professionalPurpose: optionalText(300),
    isPrimary: z.boolean(),
    consent: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.contactType === "email_profissional" && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v.contactValue)) {
      ctx.addIssue({ code: "custom", path: ["contactValue"], message: "E-mail inválido" });
    }
    if ((v.contactType === "telefone_profissional" || v.contactType === "whatsapp_profissional") && !/^\+?[0-9 ()-]{10,20}$/.test(v.contactValue)) {
      ctx.addIssue({ code: "custom", path: ["contactValue"], message: "Telefone inválido (inclua o DDD)" });
    }
    if (v.contactType === "formulario_contato" && !/^https:\/\//i.test(v.contactValue)) {
      ctx.addIssue({ code: "custom", path: ["contactValue"], message: "Informe uma URL https://" });
    }
    if (v.contactType === "whatsapp_profissional" && !v.consent) {
      ctx.addIssue({ code: "custom", path: ["consent"], message: "WhatsApp exige sua autorização expressa" });
    }
  });

export const ownEmploymentSchema = z.object({
  mediaOutletId: z.uuid("Selecione o veículo"),
  jobTitle: optionalText(120),
  locationId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  categoryIds: z.array(z.uuid()).max(10),
  startDate: z.iso.date().optional().or(z.literal("").transform(() => undefined)),
});

export const adminJournalistSchema = z.object({
  fullName: z.string().trim().min(3, "Nome obrigatório").max(160),
  professionalName: optionalText(160),
  biography: optionalText(2000),
  professionalStatus: z.enum(PROFESSIONAL_STATUSES),
  profilePhotoUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.url({ protocol: /^https$/, error: "Use uma URL https://" }).optional()),
  photoAuthorized: z.boolean(),
});

export const adminEmploymentSchema = z.object({
  journalistId: z.uuid(),
  mediaOutletId: z.uuid("Selecione o veículo"),
  jobTitle: optionalText(120),
  locationId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  categoryIds: z.array(z.uuid()).max(10),
  startDate: z.iso.date().optional().or(z.literal("").transform(() => undefined)),
  sourceUrl: optionalUrl,
  sourceTitle: optionalText(300),
});

export const adminContactSchema = z
  .object({
    journalistId: z.uuid(),
    contactType: z.enum(CONTACT_TYPES).exclude(["whatsapp_profissional"]),
    contactValue: z.string().trim().min(3).max(300),
    visibility: z.enum(CONTACT_VISIBILITIES),
    professionalPurpose: optionalText(300),
    sourceUrl: optionalUrl,
    sourceTitle: optionalText(300),
  })
  .refine((v) => v.visibility !== "assinantes" || Boolean(v.sourceUrl || v.sourceTitle), {
    path: ["sourceUrl"],
    message: "Contatos visíveis a usuários exigem fonte registrada",
  });

export const outletSchema = z.object({
  name: z.string().trim().min(2).max(160),
  website: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.url({ protocol: /^https?$/ }).optional()),
  outletType: z.enum(OUTLET_TYPES),
  headquartersCityId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
});
