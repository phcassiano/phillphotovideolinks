"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import { useAction } from "@/components/profile/use-action";
import { createOrganization } from "@/app/actions/admin/settings";

export function OrganizationForm() {
  const [name, setName] = useState("");
  const { pending, result, run } = useAction();
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => createOrganization(name), () => setName("")); }}>
      <FormMessage state={result} />
      <div className="flex gap-2">
        <Input aria-label="Nome da organização" placeholder="Nome da agência ou departamento" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" variant="outline" disabled={pending || name.trim().length < 2}>Criar</Button>
      </div>
    </form>
  );
}
