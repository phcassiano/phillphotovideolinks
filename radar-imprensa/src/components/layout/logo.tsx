import { Radar } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className={cn("flex size-8 items-center justify-center rounded-md", inverted ? "bg-white/10 text-white" : "bg-primary text-white")}>
        <Radar className="size-5" aria-hidden />
      </span>
      <span className={inverted ? "text-white" : "text-primary"}>
        Radar <span className={inverted ? "text-teal-300" : "text-accent"}>de Imprensa</span>
      </span>
    </span>
  );
}
