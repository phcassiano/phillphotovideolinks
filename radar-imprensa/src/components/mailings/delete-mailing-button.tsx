"use client";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { deleteMailing } from "@/app/actions/mailings";

export function DeleteMailingButton({ mailingId, name }: { mailingId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-danger">
          <Trash2 aria-hidden /> Excluir lista
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir “{name}”?</DialogTitle>
          <DialogDescription>A lista e suas notas privadas serão removidas. Os perfis dos jornalistas não são afetados.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button variant="destructive" disabled={pending} onClick={() => startTransition(() => deleteMailing(mailingId))}>
            Excluir definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
