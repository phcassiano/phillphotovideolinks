import { requirePermission } from "@/lib/auth/session";

// Toda a área administrativa exige papel de administrador (verificado no servidor;
// as RPCs e políticas RLS repetem a checagem no banco).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("admin.access");
  return <>{children}</>;
}
