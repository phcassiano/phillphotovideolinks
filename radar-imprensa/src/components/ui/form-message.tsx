import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs font-medium text-danger" role="alert">
      {message}
    </p>
  );
}

export function FormMessage({ state, className }: { state?: { ok: boolean; error?: string; message?: string } | null; className?: string }) {
  if (!state) return null;
  const text = state.ok ? state.message : state.error;
  if (!text) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-md px-3 py-2 text-sm",
        state.ok ? "bg-accent-soft text-accent" : "bg-danger-soft text-danger",
        className,
      )}
    >
      {state.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <span>{text}</span>
    </p>
  );
}
