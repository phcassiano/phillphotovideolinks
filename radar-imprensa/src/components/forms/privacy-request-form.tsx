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
import { PRIVACY_REQUEST_TYPES } from "@/lib/domain/enums";
import { PRIVACY_REQUEST_TYPE_LABELS } from "@/lib/domain/labels";
import { privacyRequestSchema } from "@/lib/validation/forms";
import { submitPrivacyRequest } from "@/app/actions/privacy";

type Values = z.input<typeof privacyRequestSchema>;

export function PrivacyRequestForm({ journalistId, defaultEmail }: { journalistId?: string; defaultEmail?: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string; message?: string } | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(privacyRequestSchema),
    defaultValues: { requestType: "correcao", details: "", journalistId: journalistId ?? "", contactEmail: defaultEmail ?? "" },
  });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await submitPrivacyRequest(values);
      setResult(r);
      if (r.ok) form.reset({ requestType: "correcao", details: "", journalistId: journalistId ?? "", contactEmail: defaultEmail ?? "" });
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormMessage state={result} />
      <div>
        <Label htmlFor="requestType">Tipo de solicitação</Label>
        <NativeSelect id="requestType" className="mt-1.5" {...form.register("requestType")}>
          {PRIVACY_REQUEST_TYPES.map((t) => (
            <option key={t} value={t}>
              {PRIVACY_REQUEST_TYPE_LABELS[t]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div>
        <Label htmlFor="details">Detalhes</Label>
        <Textarea
          id="details"
          className="mt-1.5"
          placeholder="Indique o perfil (nome e veículo) e o que deseja corrigir, ocultar ou excluir."
          aria-invalid={!!errors.details}
          {...form.register("details")}
        />
        <FieldError message={errors.details?.message} />
      </div>
      <div>
        <Label htmlFor="contactEmail">E-mail para resposta</Label>
        <Input id="contactEmail" type="email" className="mt-1.5" aria-invalid={!!errors.contactEmail} {...form.register("contactEmail")} />
        <FieldError message={errors.contactEmail?.message} />
      </div>
      <input type="hidden" {...form.register("journalistId")} />
      <Button type="submit" disabled={pending}>
        Enviar solicitação
      </Button>
    </form>
  );
}
