import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useForm, type FieldValues, type DefaultValues } from 'react-hook-form';
import type { z } from 'zod';

/**
 * React Hook Form + Zod. Valida no cliente com o mesmo schema que a action usa no servidor
 * e mostra também os erros devolvidos pelo servidor (`serverErrors`).
 */
export function useZodForm<S extends z.ZodType<FieldValues, FieldValues>>(
  schema: S,
  defaultValues: DefaultValues<z.input<S>>,
  serverErrors?: Record<string, string> | null,
) {
  const form = useForm<z.input<S>, unknown, z.output<S>>({
    resolver: zodResolver(schema as never) as never,
    defaultValues,
    mode: 'onTouched',
  });
  React.useEffect(() => {
    if (!serverErrors) return;
    for (const [name, message] of Object.entries(serverErrors)) {
      form.setError(name as never, { type: 'server', message });
    }
  }, [serverErrors, form]);
  const err = (name: string) => {
    const e = name.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], form.formState.errors) as
      | { message?: string }
      | undefined;
    return e?.message;
  };
  return { ...form, err };
}
