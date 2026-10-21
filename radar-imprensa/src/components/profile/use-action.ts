"use client";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/errors";

// Executa uma Server Action e guarda o último resultado para exibição.
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string; message?: string } | null>(null);
  const run = (fn: () => Promise<ActionResult<unknown>>, onSuccess?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) onSuccess?.();
    });
  return { pending, result, run, setResult };
}
