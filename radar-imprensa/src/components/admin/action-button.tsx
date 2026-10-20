"use client";
import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";

// Botão que executa uma Server Action (já vinculada aos seus argumentos) e
// mostra o resultado. Opcionalmente pede confirmação.
export function ActionButton({
  action,
  children,
  confirmText,
  showResult = true,
  className,
  ...props
}: Omit<ButtonProps, "onClick"> & {
  action: () => Promise<ActionResult<unknown>>;
  confirmText?: string;
  showResult?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<unknown> | null>(null);
  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <Button
        {...props}
        disabled={pending || props.disabled}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          startTransition(async () => setResult(await action()));
        }}
      >
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
        {children}
      </Button>
      {showResult && result ? (
        <span role={result.ok ? "status" : "alert"} className={cn("text-xs", result.ok ? "text-accent" : "text-danger")}>
          {result.ok ? result.message : result.error}
        </span>
      ) : null}
    </span>
  );
}
