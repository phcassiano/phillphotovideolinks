"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck, GitMerge, History, LayoutDashboard, ListChecks, Mail, RefreshCw, ScrollText, Search,
  Settings, ShieldCheck, SlidersHorizontal, Sparkles, Star, Upload, User, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavIcon, NavSection } from "./nav-items";

const ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard, search: Search, star: Star, mail: Mail, history: History, sparkles: Sparkles,
  user: User, badge: BadgeCheck, shield: ShieldCheck, admin: SlidersHorizontal, users: Users, upload: Upload,
  refresh: RefreshCw, list: ListChecks, settings: Settings, scroll: ScrollText, merge: GitMerge,
};

export function AppNav({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" || href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-6">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/50">{section.title}</p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white",
                      active && "bg-white/15 font-medium text-white",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
