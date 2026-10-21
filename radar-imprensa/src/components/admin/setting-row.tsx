"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/profile/use-action";
import { updateSetting } from "@/app/actions/admin/settings";

export function SettingRow({ settingKey, value, description }: { settingKey: string; value: number; description: string | null }) {
  const [v, setV] = useState(String(value));
  const { pending, result, run } = useAction();
  return (
    <div className="flex flex-col gap-2 border-b py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-mono text-xs">{settingKey}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <Input aria-label={settingKey} type="number" min={0} className="h-8 w-28" value={v} onChange={(e) => setV(e.target.value)} />
        <Button size="sm" variant="outline" disabled={pending || Number(v) === value} onClick={() => run(() => updateSetting(settingKey, Number(v)))}>Salvar</Button>
        {result && !result.ok ? <span className="text-xs text-danger">{result.error}</span> : null}
      </div>
    </div>
  );
}
