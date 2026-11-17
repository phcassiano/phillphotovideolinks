import { z } from 'zod';
import { email, password } from './common';

export const loginSchema = z.object({ email, password: z.string().min(1, 'Informe a senha.') });
export const recoverSchema = z.object({ email });
export const resetPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: 'As senhas não conferem.', path: ['confirm'] });
