"use client";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { INTERACTION_TYPES } from "@/lib/domain/enums";
import { INTERACTION_TYPE_LABELS } from "@/lib/domain/labels";
import { interactionSchema } from "@/lib/validation/forms";
import { createInteraction } from "@/app/actions/interactions";

type Values = z.input<typeof interactionSchema>;

export function InteractionForm({ journalists, defaultJournalistId, today }: { journalists: { id: string; name: string }[]; defaultJournalistId?: string; today: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string; message?: string } | null>(null);
  const defaults: Values = { journalistId: defaultJournalistId ?? "", interactionType: "email", subject: "", notes: "", interactionDate: today };
  const form = useForm<Values>({ resolver: zodResolver(interactionSchema), defaultValues: defaults });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await createInteraction(values);
      setResult(r);
      if (r.ok) form.reset({ ...defaults, journalistId: values.journalistId });
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormMessage state={result} />
      <div>
        <Label htmlFor="int-journalist">Jornalista</Label>
        <NativeSelect id="int-journalist" className="mt-1.5" aria-invalid={!!errors.journalistId} {...form.register("journalistId")}>
          <option value="">Selecione…</option>
          {journalists.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </NativeSelect>
        <FieldError message={errors.journalistId?.message} />
        <p className="mt-1 text-xs text-muted-foreground">Lista com seus favoritos e membros dos seus mailings.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="int-type">Tipo</Label>
          <NativeSelect id="int-type" className="mt-1.5" {...form.register("interactionType")}>
            {INTERACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {INTERACTION_TYPE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="int-date">Data</Label>
          <Input id="int-date" type="date" className="mt-1.5" max={today} {...form.register("interactionDate")} />
          <FieldError message={errors.interactionDate?.message} />
        </div>
      </div>
      <div>
        <Label htmlFor="int-subject">Assunto</Label>
        <Input id="int-subject" className="mt-1.5" aria-invalid={!!errors.subject} {...form.register("subject")} />
        <FieldError message={errors.subject?.message} />
      </div>
      <div>
        <Label htmlFor="int-notes">Notas privadas</Label>
        <Textarea id="int-notes" className="mt-1.5" {...form.register("notes")} />
      </div>
      <Button type="submit" disabled={pending}>
        Registrar interação
      </Button>
    </form>
  );
}
