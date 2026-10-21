import { Building2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { EmploymentSummary } from "@/lib/domain/types";
import { OUTLET_TYPE_LABELS } from "@/lib/domain/labels";

export function employmentPlace(e: EmploymentSummary): string | null {
  if (!e.location) return null;
  return e.location.city_name ? `${e.location.city_name}/${e.location.state_code}` : `${e.location.state_name} (estado)`;
}

export function EmploymentLine({ employment, compact = false }: { employment: EmploymentSummary; compact?: boolean }) {
  const place = employmentPlace(employment);
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-medium">{employment.job_title ?? "Cargo não informado"}</span>
        <span className="text-muted-foreground">·</span>
        <span className="inline-flex items-center gap-1">
          <Building2 className="size-3.5 text-muted-foreground" aria-hidden />
          {employment.outlet.name}
        </span>
        {employment.outlet.outlet_type ? (
          <Badge variant="outline">{OUTLET_TYPE_LABELS[employment.outlet.outlet_type]}</Badge>
        ) : null}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3" aria-hidden />
          {place ?? "Local não informado"}
        </span>
        {!compact && employment.categories.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {employment.categories.map((c) => (
              <Badge key={c.id} variant="default">
                {c.name}
              </Badge>
            ))}
          </span>
        ) : null}
        {!compact && employment.categories.length === 0 ? <span>Editoria não informada</span> : null}
      </p>
    </div>
  );
}
