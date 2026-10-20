"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { MAILING_VISIBILITIES } from "@/lib/domain/enums";
import { MAILING_VISIBILITY_LABELS } from "@/lib/domain/labels";
import { mailingSchema } from "@/lib/validation/forms";
import { createMailing, updateMailing } from "@/app/actions/mailings";

type Values = z.input<typeof mailingSchema>;

export function MailingForm({
  mailingId,
  defaults,
  hasOrganization,
}: {
  mailingId?: string;
  defaults?: Partial<Values>;
  hasOrganization: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string; message?: string } | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(mailingSchema),
    defaultValues: { name: "", description: "", visibility: "privada", ...defaults },
  });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      if (mailingId) {
        setResult(await updateMailing(mailingId, values));
        return;
      }
      const r = await createMailing(values);
      setResult(r);
      if (r.ok && r.data) router.push(`/mailings/${r.data.id}`);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormMessage state={result} />
      <div>
        <Label htmlFor="mailing-name">Nome</Label>
        <Input id="mailing-name" className="mt-1.5" placeholder="Ex.: Cultura — Rio de Janeiro" aria-invalid={!!errors.name} {...form.register("name")} />
        <FieldError message={errors.name?.message} />
      </div>
      <div>
        <Label htmlFor="mailing-description">Descrição (opcional)</Label>
        <Textarea id="mailing-description" className="mt-1.5 min-h-16" {...form.register("description")} />
      </div>
      <div>
        <Label htmlFor="mailing-visibility">Visibilidade</Label>
        <NativeSelect id="mailing-visibility" className="mt-1.5" {...form.register("visibility")}>
          {MAILING_VISIBILITIES.map((v) => (
            <option key={v} value={v} disabled={v === "organizacao" && !hasOrganization}>
              {MAILING_VISIBILITY_LABELS[v]}
              {v === "organizacao" && !hasOrganization ? " (sem organização)" : ""}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button type="submit" disabled={pending}>
        {mailingId ? "Salvar alterações" : "Criar lista"}
      </Button>
    </form>
  );
}
