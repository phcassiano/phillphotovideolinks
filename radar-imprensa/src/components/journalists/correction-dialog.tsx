"use client";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { correctionSchema } from "@/lib/validation/forms";
import { suggestCorrection } from "@/app/actions/journalists";

type Values = z.input<typeof correctionSchema>;

export function CorrectionDialog({ journalistId, journalistName }: { journalistId: string; journalistName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string; message?: string } | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(correctionSchema), defaultValues: { journalistId, description: "", sourceUrl: "" } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await suggestCorrection(values);
      setResult(r);
      if (r.ok) form.reset({ journalistId, description: "", sourceUrl: "" });
    }),
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setResult(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <MessageSquare aria-hidden /> Sugerir correção
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sugerir correção</DialogTitle>
          <DialogDescription>
            Sobre {journalistName}. A sugestão é revisada por um administrador antes de qualquer alteração.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormMessage state={result} />
          <div>
            <Label htmlFor="correction-description">O que está incorreto ou desatualizado?</Label>
            <Textarea id="correction-description" className="mt-1.5" aria-invalid={!!errors.description} {...form.register("description")} />
            <FieldError message={errors.description?.message} />
          </div>
          <div>
            <Label htmlFor="correction-source">Fonte pública que comprova (opcional)</Label>
            <Input id="correction-source" className="mt-1.5" placeholder="https://" aria-invalid={!!errors.sourceUrl} {...form.register("sourceUrl")} />
            <FieldError message={errors.sourceUrl?.message} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Enviar sugestão
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
