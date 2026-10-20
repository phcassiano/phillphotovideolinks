"use client";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { removeFromMailing, updateMemberNotes } from "@/app/actions/mailings";

export function MemberNotes({ mailingId, journalistId, initial, editable }: { mailingId: string; journalistId: string; initial: string | null; editable: boolean }) {
  const [notes, setNotes] = useState(initial ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!editable) return initial ? <p className="text-xs text-muted-foreground">Nota: {initial}</p> : null;
  return (
    <div className="w-full sm:w-72">
      <label className="sr-only" htmlFor={`notes-${journalistId}`}>
        Nota privada
      </label>
      <Textarea
        id={`notes-${journalistId}`}
        className="min-h-16 text-xs"
        placeholder="Nota privada (visível a quem acessa a lista)"
        value={notes}
        maxLength={1000}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground" aria-live="polite">{status}</span>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || notes === (initial ?? "")}
          onClick={() =>
            startTransition(async () => {
              const r = await updateMemberNotes({ mailingId, journalistId, notes });
              setStatus(r.ok ? "Salvo" : r.error);
            })
          }
        >
          Salvar nota
        </Button>
      </div>
    </div>
  );
}

export function RemoveMemberButton({ mailingId, journalistId }: { mailingId: string; journalistId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(async () => void (await removeFromMailing(mailingId, journalistId)))}
      aria-label="Remover da lista"
    >
      <Trash2 aria-hidden /> Remover
    </Button>
  );
}
