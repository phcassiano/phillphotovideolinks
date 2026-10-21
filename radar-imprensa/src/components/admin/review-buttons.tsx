"use client";
import { useState, useTransition } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/errors";

// Aprovar/rejeitar com nota de revisão opcional.
export function ReviewButtons({
  onDecide,
  approveLabel = "Aprovar",
  rejectLabel = "Rejeitar",
  approveDisabledReason,
}: {
  onDecide: (approve: boolean, notes: string) => Promise<ActionResult<unknown>>;
  approveLabel?: string;
  rejectLabel?: string;
  approveDisabledReason?: string;
}) {
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<unknown> | null>(null);
  if (result?.ok) return <p role="status" className="text-sm text-accent">{result.message}</p>;
  return (
    <div className="space-y-2">
      <Textarea aria-label="Nota da revisão" placeholder="Nota da revisão (opcional)" className="min-h-14 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="accent" disabled={pending || Boolean(approveDisabledReason)} title={approveDisabledReason} onClick={() => startTransition(async () => setResult(await onDecide(true, notes)))}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Check aria-hidden />} {approveLabel}
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => setResult(await onDecide(false, notes)))}>
          <X aria-hidden /> {rejectLabel}
        </Button>
      </div>
      {approveDisabledReason ? <p className="text-xs text-muted-foreground">{approveDisabledReason}</p> : null}
      {result && !result.ok ? <p role="alert" className="text-xs text-danger">{result.error}</p> : null}
    </div>
  );
}
