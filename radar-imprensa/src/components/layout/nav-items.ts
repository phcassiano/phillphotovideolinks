import type { Permission } from "@/lib/auth/permissions";

export type NavIcon =
  | "dashboard" | "search" | "star" | "mail" | "history" | "sparkles" | "user" | "badge" | "shield"
  | "admin" | "users" | "upload" | "refresh" | "list" | "settings" | "scroll" | "merge";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  permission: Permission | "authenticated";
  feature?: "pauta";
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Trabalho",
    items: [
      { href: "/dashboard", label: "Visão geral", icon: "dashboard", permission: "authenticated" },
      { href: "/jornalistas", label: "Jornalistas", icon: "search", permission: "journalists.search" },
      { href: "/favoritos", label: "Favoritos", icon: "star", permission: "favorites.manage" },
      { href: "/mailings", label: "Mailings", icon: "mail", permission: "mailings.manage" },
      { href: "/interacoes", label: "Interações", icon: "history", permission: "interactions.manage" },
      { href: "/pautas", label: "Minha pauta (beta)", icon: "sparkles", permission: "journalists.search", feature: "pauta" },
    ],
  },
  {
    title: "Conta",
    items: [
      { href: "/meu-perfil", label: "Meu perfil", icon: "user", permission: "authenticated" },
      { href: "/reivindicar-perfil", label: "Reivindicar perfil", icon: "badge", permission: "profile.claim" },
      { href: "/privacidade", label: "Privacidade", icon: "shield", permission: "authenticated" },
    ],
  },
  {
    title: "Administração",
    items: [
      { href: "/admin", label: "Painel", icon: "admin", permission: "admin.access" },
      { href: "/admin/jornalistas", label: "Cadastro", icon: "users", permission: "admin.journalists" },
      { href: "/admin/importacoes", label: "Importações", icon: "upload", permission: "admin.imports" },
      { href: "/admin/verificacoes", label: "Verificações", icon: "refresh", permission: "admin.verifications" },
      { href: "/admin/revisoes", label: "Revisões", icon: "list", permission: "admin.reviews" },
      { href: "/admin/duplicidades", label: "Duplicidades", icon: "merge", permission: "admin.reviews" },
      { href: "/admin/usuarios", label: "Usuários", icon: "users", permission: "admin.users" },
      { href: "/admin/configuracoes", label: "Configurações", icon: "settings", permission: "admin.settings" },
      { href: "/admin/auditoria", label: "Auditoria", icon: "scroll", permission: "admin.audit" },
    ],
  },
];
