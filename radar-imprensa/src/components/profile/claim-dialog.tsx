"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/ui/form-message";
import { CLAIM_METHODS, type ClaimMethod } from "@/lib/domain/enums";
import { CLAIM_METHOD_LABELS } from "@/lib/domain/labels";
import { submitClaim } from "@/app/actions/profile";
import { useAction } from "./use-action";

export function ClaimDialog({ journalistId, name }: { journalistId: string; name: string }) {
  const { pending, result, run, setResult } = useAction();
  const [method, setMethod] = useState<ClaimMethod>("email_corporativo");
  const [evidence, setEvidence] = useState("");
  return (
    <Dialog onOpenChange={(o) => { if (!o) setResult(null); }}>
      <DialogTrigger asChild>
        <Button size="sm">Este sou eu</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reivindicar o perfil de {name}</DialogTitle>
          <DialogDescription>
            A administração confere as evidências antes de vincular o perfil à sua conta. Contas com e-mail do domínio do veículo
            recebem um sinal adicional, mas a aprovação é sempre humana.
          </DialogDescription>
        </DialogHeader>
        <FormMessage state={result} />
        {result?.ok ? null : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="claim-method">Como podemos confirmar sua identidade?</Label>
              <NativeSelect id="claim-method" className="mt-1.5" value={method} onChange={(e) => setMethod(e.target.value as ClaimMethod)}>
                {CLAIM_METHODS.map((m) => <option key={m} value={m}>{CLAIM_METHOD_LABELS[m]}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="claim-evidence">Evidências (links do expediente, perfil institucional, contato da redação)</Label>
              <Textarea id="claim-evidence" className="mt-1.5" value={evidence} maxLength={2000} onChange={(e) => setEvidence(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Não envie documentos pessoais por aqui; a administração solicitará por canal seguro se necessário.</p>
            </div>
          </div>
        )}
        <DialogFooter>
          {result?.ok ? null : (
            <Button disabled={pending} onClick={() => run(() => submitClaim({ journalistId, method, evidenceText: evidence }))}>
              Enviar reivindicação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
