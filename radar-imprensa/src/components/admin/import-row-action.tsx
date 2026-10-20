"use client";
import { useState, useTransition } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { setRowAction } from "@/app/actions/admin/imports";

export function ImportRowAction({ batchId, rowNumber, action, canLink, hasErrors, disabled }: { batchId: string; rowNumber: number; action: "criar" | "vincular" | "ignorar"; canLink: boolean; hasErrors: boolean; disabled: boolean }) {
  const [value, setValue] = useState(action);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <NativeSelect
        aria-label={`Ação da linha ${rowNumber}`}
        className="h-8 min-w-32 text-xs"
        value={value}
        disabled={disabled || pending || hasErrors}
        onChange={(e) => {
          const next = e.target.value as typeof value;
          const previous = value;
          setValue(next);
          startTransition(async () => {
            const r = await setRowAction(batchId, rowNumber, next);
            if (!r.ok) {
              setValue(previous);
              setError(r.error);
            } else setError(null);
          });
        }}
      >
        <option value="criar">Criar novo</option>
        {canLink ? <option value="vincular">Vincular ao existente</option> : null}
        <option value="ignorar">Ignorar</option>
      </NativeSelect>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
