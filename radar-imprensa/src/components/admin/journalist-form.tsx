"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { PROFESSIONAL_STATUSES } from "@/lib/domain/enums";
import { PROFESSIONAL_STATUS_LABELS } from "@/lib/domain/labels";
import { adminJournalistSchema } from "@/lib/validation/forms";
import { createJournalist, updateJournalist } from "@/app/actions/admin/journalists";

type Values = z.input<typeof adminJournalistSchema>;

export function JournalistForm({ journalistId, defaults }: { journalistId?: string; defaults?: Partial<Values> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string; message?: string } | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(adminJournalistSchema),
    defaultValues: { fullName: "", professionalName: "", biography: "", professionalStatus: "desconhecido", profilePhotoUrl: "", photoAuthorized: false, ...defaults },
  });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      if (journalistId) {
        setResult(await updateJournalist(journalistId, values));
        return;
      }
      const r = await createJournalist(values);
      setResult(r);
      if (r.ok && r.data) router.push(`/admin/jornalistas/${r.data.id}`);
    }),
  );
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormMessage state={result} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="j-name">Nome completo</Label>
          <Input id="j-name" className="mt-1.5" aria-invalid={!!errors.fullName} {...form.register("fullName")} />
          <FieldError message={errors.fullName?.message} />
        </div>
        <div>
          <Label htmlFor="j-pro">Nome profissional</Label>
          <Input id="j-pro" className="mt-1.5" {...form.register("professionalName")} />
        </div>
        <div>
          <Label htmlFor="j-status">Situação profissional</Label>
          <NativeSelect id="j-status" className="mt-1.5" {...form.register("professionalStatus")}>
            {PROFESSIONAL_STATUSES.map((s) => <option key={s} value={s}>{PROFESSIONAL_STATUS_LABELS[s]}</option>)}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="j-photo">URL da foto (https)</Label>
          <Input id="j-photo" className="mt-1.5" aria-invalid={!!errors.profilePhotoUrl} {...form.register("profilePhotoUrl")} />
          <FieldError message={errors.profilePhotoUrl?.message} />
          <label className="mt-2 flex items-center gap-2 text-xs">
            <Checkbox {...form.register("photoAuthorized")} /> Uso da foto autorizado pelo titular
          </label>
        </div>
      </div>
      <div>
        <Label htmlFor="j-bio">Biografia profissional</Label>
        <Textarea id="j-bio" className="mt-1.5" {...form.register("biography")} />
      </div>
      <Button type="submit" disabled={pending}>{journalistId ? "Salvar" : "Cadastrar"}</Button>
    </form>
  );
}
