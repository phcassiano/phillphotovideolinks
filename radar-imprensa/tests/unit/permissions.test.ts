import { describe, expect, it } from "vitest";
import { can, canAccessPath, isAdminRole, requiredPermissionFor } from "@/lib/auth/permissions";

describe("matriz de permissões", () => {
  it("assessor pesquisa, salva favoritos e cria mailings, mas não administra", () => {
    expect(can("assessor", "journalists.search")).toBe(true);
    expect(can("assessor", "mailings.manage")).toBe(true);
    expect(can("assessor", "admin.access")).toBe(false);
    expect(can("assessor", "profile.claim")).toBe(false);
  });

  it("jornalista reivindica e gerencia o próprio perfil", () => {
    expect(can("jornalista", "profile.claim")).toBe(true);
    expect(can("jornalista", "profile.manageOwn")).toBe(true);
    expect(can("jornalista", "mailings.manage")).toBe(false);
  });

  it("somente o administrador principal gerencia usuários, configurações e auditoria", () => {
    for (const p of ["admin.users", "admin.settings", "admin.audit"] as const) {
      expect(can("admin", p)).toBe(false);
      expect(can("super_admin", p)).toBe(true);
    }
    expect(can("admin", "admin.imports")).toBe(true);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("assessor")).toBe(false);
  });

  it("usuário sem papel não acessa nada protegido", () => {
    expect(can(null, "journalists.search")).toBe(false);
    expect(canAccessPath(null, "/dashboard")).toBe(false);
    expect(canAccessPath(null, "/")).toBe(true);
  });

  it("rotas administrativas exigem a permissão mais específica", () => {
    expect(requiredPermissionFor("/admin/usuarios")).toBe("admin.users");
    expect(requiredPermissionFor("/admin/importacoes/abc")).toBe("admin.access");
    expect(canAccessPath("assessor", "/admin")).toBe(false);
    expect(canAccessPath("admin", "/admin/revisoes")).toBe(true);
    expect(canAccessPath("admin", "/admin/configuracoes")).toBe(false);
    expect(canAccessPath("jornalista", "/mailings")).toBe(false);
    expect(requiredPermissionFor("/privacidade")).toBeNull();
    expect(requiredPermissionFor("/administracao-falsa")).toBeNull();
  });
});
