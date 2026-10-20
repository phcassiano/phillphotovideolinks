import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("relative flex gap-3 rounded-lg border p-4 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0", {
  variants: {
    variant: {
      default: "bg-surface",
      info: "border-info/30 bg-info-soft text-foreground [&>svg]:text-info",
      success: "border-accent/30 bg-accent-soft text-foreground [&>svg]:text-accent",
      warning: "border-warning/30 bg-warning-soft text-foreground [&>svg]:text-warning",
      danger: "border-danger/30 bg-danger-soft text-foreground [&>svg]:text-danger",
    },
  },
  defaultVariants: { variant: "default" },
});

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role={variant === "danger" ? "alert" : "status"} className={cn(alertVariants({ variant }), className)} {...props} />;
}
function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("font-semibold", className)} {...props} />;
}
function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-muted-foreground [&_p]:leading-relaxed", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
