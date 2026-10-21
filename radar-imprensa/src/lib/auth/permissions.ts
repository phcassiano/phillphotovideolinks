import type { UserRole } from "@/lib/domain/enums";

// Matriz de permissões da aplicação. É uma camada de UX e de verificação
// antecipada no servidor: a autorização definitiva está nas políticas RLS e
// nas RPCs do banco.
export type Permission =
  | "journalists.search"
  | "favorites.manage"
  | "mailings.manage"
  | "interactions.manage"
  | "corrections.suggest"
  | "profile.claim"
  | "profile.manageOwn"
  | "admin.access"
  | "admin.journalists"
  | "admin.imports"
  | "admin.reviews"
  | "admin.verifications"
  | "admin.users"
  | "admin.settings"
  | "admin.audit";

const ALL_USER: Permission[] = ["journalists.search", "corrections.suggest"];

const MATRIX: Record<UserRole, Permission[]> = {
  assessor: [...ALL_USER, "favorites.manage", "mailings.manage", "interactions.manage"],
  jornalista: [...ALL_USER, "profile.claim", "profile.manageOwn"],
  admin: [
    ...ALL_USER,
    "favorites.manage",
    "mailings.manage",
    "interactions.manage",
    "admin.access",
    "admin.journalists",
    "admin.imports",
    "admin.reviews",
    "admin.verifications",
  ],
  super_admin: [
    ...ALL_USER,
    "favorites.manage",
    "mailings.manage",
    "interactions.manage",
    "admin.access",
    "admin.journalists",
    "admin.imports",
    "admin.reviews",
    "admin.verifications",
    "admin.users",
    "admin.settings",
    "admin.audit",
  ],
};

export function can(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role]?.includes(permission) ?? false;
}

export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

// Rotas protegidas e a permissão mínima exigida (usado no proxy e nos layouts).
const ROUTE_RULES: { prefix: string; permission: Permission | "authenticated" }[] = [
  { prefix: "/admin/usuarios", permission: "admin.users" },
  { prefix: "/admin/configuracoes", permission: "admin.settings" },
  { prefix: "/admin/auditoria", permission: "admin.audit" },
  { prefix: "/admin", permission: "admin.access" },
  { prefix: "/mailings", permission: "mailings.manage" },
  { prefix: "/favoritos", permission: "favorites.manage" },
  { prefix: "/interacoes", permission: "interactions.manage" },
  { prefix: "/reivindicar-perfil", permission: "profile.claim" },
  { prefix: "/dashboard", permission: "authenticated" },
  { prefix: "/jornalistas", permission: "journalists.search" },
  { prefix: "/meu-perfil", permission: "authenticated" },
  { prefix: "/pautas", permission: "journalists.search" },
];

export function requiredPermissionFor(pathname: string): Permission | "authenticated" | null {
  const rule = ROUTE_RULES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  return rule ? rule.permission : null;
}

export function canAccessPath(role: UserRole | null | undefined, pathname: string): boolean {
  const permission = requiredPermissionFor(pathname);
  if (permission === null) return true;
  if (!role) return false;
  return permission === "authenticated" ? true : can(role, permission);
}
