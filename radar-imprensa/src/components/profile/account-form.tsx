"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/ui/form-message";
import { updateAccount } from "@/app/actions/profile";
import { useAction } from "./use-action";

export function AccountForm({ fullName }: { fullName: string }) {
  const [name, setName] = useState(fullName);
  const { pending, result, run } = useAction();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateAccount({ fullName: name }));
      }}
    >
      <FormMessage state={result} />
      <div>
        <Label htmlFor="account-name">Nome completo</Label>
        <Input id="account-name" className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} minLength={3} maxLength={160} required />
      </div>
      <Button type="submit" disabled={pending || name.trim().length < 3}>
        Salvar
      </Button>
    </form>
  );
}
