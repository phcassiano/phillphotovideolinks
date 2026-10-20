"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { FormMessage } from "@/components/ui/form-message";
import { addToMailing, createMailing } from "@/app/actions/mailings";

export interface MailingOption {
  id: string;
  name: string;
}

export function AddToMailingDialog({
  journalistIds,
  mailings,
  trigger,
}: {
  journalistIds: string[];
  mailings: MailingOption[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mailingId, setMailingId] = useState(mailings[0]?.id ?? "__new");
  const [newName, setNewName] = useState("");
  const [result, setResult] = useState<{ ok: boolean; error?: string; message?: string } | null>(null);

  const submit = () =>
    startTransition(async () => {
      setResult(null);
      let target = mailingId;
      if (target === "__new") {
        const created = await createMailing({ name: newName, visibility: "privada" });
        if (!created.ok || !created.data) {
          setResult(created.ok ? { ok: false, error: "Não foi possível criar a lista." } : created);
          return;
        }
        target = created.data.id;
      }
      setResult(await addToMailing(target, journalistIds));
    });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setResult(null); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" disabled={journalistIds.length === 0}>
            <ListPlus aria-hidden /> Adicionar a mailing
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar a um mailing</DialogTitle>
          <DialogDescription>
            {journalistIds.length === 1 ? "1 jornalista selecionado." : `${journalistIds.length} jornalistas selecionados.`}
          </DialogDescription>
        </DialogHeader>
        <FormMessage state={result} />
        <div className="space-y-3">
          <div>
            <Label htmlFor="mailing-target">Lista</Label>
            <NativeSelect id="mailing-target" className="mt-1.5" value={mailingId} onChange={(e) => setMailingId(e.target.value)}>
              {mailings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              <option value="__new">+ Nova lista…</option>
            </NativeSelect>
          </div>
          {mailingId === "__new" ? (
            <div>
              <Label htmlFor="mailing-new-name">Nome da nova lista</Label>
              <Input
                id="mailing-new-name"
                className="mt-1.5"
                placeholder="Ex.: Política — Brasília"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          {result?.ok ? (
            <Button asChild variant="outline">
              <Link href="/mailings">Ver mailings</Link>
            </Button>
          ) : null}
          <Button onClick={submit} disabled={pending || journalistIds.length === 0 || (mailingId === "__new" && newName.trim().length < 2)}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
