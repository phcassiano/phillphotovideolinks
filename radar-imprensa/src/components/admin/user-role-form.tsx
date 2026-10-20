"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/components/profile/use-action";
import { USER_ROLES, type UserRole } from "@/lib/domain/enums";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { setUserRole } from "@/app/actions/admin/settings";

export function UserRoleForm({ userId, role, organizationId, organizations }: { userId: string; role: UserRole; organizationId: string | null; organizations: { id: string; name: string }[] }) {
  const [r, setR] = useState(role);
  const [org, setOrg] = useState(organizationId ?? "");
  const { pending, result, run } = useAction();
  const changed = r !== role || (org || null) !== organizationId;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect aria-label="Papel" className="h-8 w-48 text-xs" value={r} onChange={(e) => setR(e.target.value as UserRole)}>
        {USER_ROLES.map((x) => <option key={x} value={x}>{ROLE_LABELS[x]}</option>)}
      </NativeSelect>
      <NativeSelect aria-label="Organização" className="h-8 w-48 text-xs" value={org} onChange={(e) => setOrg(e.target.value)}>
        <option value="">Sem organização</option>
        {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </NativeSelect>
      <Button size="sm" variant="outline" disabled={pending || !changed} onClick={() => run(() => setUserRole(userId, r, org || null))}>Salvar</Button>
      {result ? <span className={result.ok ? "text-xs text-accent" : "text-xs text-danger"}>{result.ok ? result.message : result.error}</span> : null}
    </div>
  );
}
