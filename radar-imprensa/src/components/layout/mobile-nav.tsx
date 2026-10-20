"use client";
import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { AppNav } from "./app-nav";
import { Logo } from "./logo";
import type { NavSection } from "./nav-items";

export function MobileNav({ sections }: { sections: NavSection[] }) {
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        className="inline-flex size-10 items-center justify-center rounded-md text-primary hover:bg-muted lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="size-5" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-primary/50 lg:hidden" />
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-primary p-4 shadow-xl lg:hidden">
          <div className="flex items-center justify-between">
            <DialogPrimitive.Title asChild>
              <span><Logo inverted /></span>
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-md p-2 text-white/80 hover:bg-white/10" aria-label="Fechar menu">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">Menu de navegação</DialogPrimitive.Description>
          <AppNav sections={sections} onNavigate={() => setOpen(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
