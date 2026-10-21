"use client";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteInteraction } from "@/app/actions/interactions";

export function DeleteInteractionButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="ghost" size="icon" aria-label="Excluir interação" disabled={pending} onClick={() => startTransition(async () => void (await deleteInteraction(id)))}>
      <Trash2 />
    </Button>
  );
}
