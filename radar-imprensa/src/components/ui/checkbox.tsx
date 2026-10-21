import * as React from "react";
import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn("size-4 shrink-0 rounded border-input accent-primary focus-visible:outline-2 focus-visible:outline-ring", className)}
      {...props}
    />
  );
}

export { Checkbox };
