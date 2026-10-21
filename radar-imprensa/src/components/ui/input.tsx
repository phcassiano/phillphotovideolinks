import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground/80 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger file:mr-3 file:border-0 file:bg-muted file:px-2 file:py-1 file:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
