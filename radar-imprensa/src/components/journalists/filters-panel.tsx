"use client";
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// No celular, os filtros ficam recolhidos atrás de um botão; no desktop, sempre visíveis.
export function FiltersPanel({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <aside className="h-fit rounded-lg border bg-surface p-4 lg:sticky lg:top-20">
      <Button type="button" variant="outline" className="w-full lg:hidden" aria-expanded={open} aria-controls="painel-filtros" onClick={() => setOpen(!open)}>
        <SlidersHorizontal aria-hidden /> {open ? "Ocultar filtros" : "Filtros"}
        {activeCount > 0 ? <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{activeCount}</span> : null}
      </Button>
      <div id="painel-filtros" className={cn("mt-4 lg:mt-0 lg:block", open ? "block" : "hidden")}>
        {children}
      </div>
    </aside>
  );
}
