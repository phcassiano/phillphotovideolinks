import Link from "next/link";
import { LogOut } from "lucide-react";
import { AppNav } from "@/components/layout/app-nav";
import { Logo } from "@/components/layout/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NAV_SECTIONS, type NavSection } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { requireUser, type SessionUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { serverEnv } from "@/lib/env.server";
import { signOut } from "@/app/actions/auth";

// Toda a área autenticada depende da sessão: nunca pré-renderizar no build.
export const dynamic = "force-dynamic";

function sectionsFor(user: SessionUser): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        (item.permission === "authenticated" || can(user.role, item.permission)) &&
        (item.feature !== "pauta" || serverEnv.featurePautaMatching),
    ),
  })).filter((section) => section.items.length > 0);
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const sections = sectionsFor(user);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 overflow-y-auto bg-primary p-4 lg:flex">
        <Link href="/dashboard" className="px-2 py-1" aria-label="Radar de Imprensa — visão geral">
          <Logo inverted />
        </Link>
        <AppNav sections={sections} />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-surface/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-2">
            <MobileNav sections={sections} />
            <Link href="/dashboard" className="lg:hidden" aria-label="Visão geral">
              <Logo />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{user.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {ROLE_LABELS[user.role]}
                {user.organizationName ? ` · ${user.organizationName}` : ""}
              </p>
            </div>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" aria-label="Sair">
                <LogOut aria-hidden />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </form>
          </div>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
