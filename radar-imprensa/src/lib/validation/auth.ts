import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Informe um e-mail válido").trim().toLowerCase(),
  password: z.string().min(1, "Informe a senha"),
});

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(3, "Informe seu nome completo").max(160),
    email: z.email("Informe um e-mail válido").trim().toLowerCase(),
    password: z
      .string()
      .min(10, "Use pelo menos 10 caracteres")
      .max(72, "Máximo de 72 caracteres")
      .regex(/[A-Za-z]/, "Inclua letras")
      .regex(/[0-9]/, "Inclua números"),
    confirmPassword: z.string(),
    accountType: z.enum(["assessor", "jornalista"]),
    organizationName: z.string().trim().max(160).optional(),
    acceptTerms: z.literal(true, { error: "É preciso aceitar os termos e a política de privacidade" }),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "As senhas não coincidem" });

export type SignupInput = z.input<typeof signupSchema>;
