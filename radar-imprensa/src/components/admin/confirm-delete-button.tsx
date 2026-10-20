"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function ConfirmDeleteButton({ action, label, confirmText }: { action: () => Promise<void>; label: string; confirmText: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="destructive"
      className="w-full"
      disabled={pending}
      onClick={() => {
        if (window.confirm(confirmText)) startTransition(() => action());
      }}
    >
      {label}
    </Button>
  );
}
