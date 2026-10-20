"use client";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleFavorite } from "@/app/actions/journalists";

export function RemoveFavoriteButton({ journalistId }: { journalistId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(async () => void (await toggleFavorite(journalistId, false)))}>
      <Trash2 aria-hidden /> Remover
    </Button>
  );
}
