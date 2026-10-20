"use client";
import { useOptimistic, useTransition } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleFavorite } from "@/app/actions/journalists";
import { cn } from "@/lib/utils";

export function FavoriteButton({ journalistId, initial, withLabel = false }: { journalistId: string; initial: boolean; withLabel?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [favorite, setFavorite] = useOptimistic(initial);
  const label = favorite ? "Remover dos favoritos" : "Salvar nos favoritos";
  return (
    <Button
      type="button"
      variant={withLabel ? "outline" : "ghost"}
      size={withLabel ? "default" : "icon"}
      aria-pressed={favorite}
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          setFavorite(!favorite);
          await toggleFavorite(journalistId, !favorite);
        })
      }
    >
      <Star className={cn(favorite ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} aria-hidden />
      {withLabel ? (favorite ? "Favorito" : "Favoritar") : null}
    </Button>
  );
}
