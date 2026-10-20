import Link from "next/link";
import { Mail, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VerificationBadge } from "@/components/ui/verification-badge";
import type { JournalistSearchItem } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { EmploymentLine } from "./employment-line";

export function ResultCardBody({ item }: { item: JournalistSearchItem }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/jornalistas/${item.id}`} className="text-base font-semibold text-primary hover:underline">
          {item.full_name}
        </Link>
        {item.professional_name && item.professional_name !== item.full_name ? (
          <span className="text-sm text-muted-foreground">({item.professional_name})</span>
        ) : null}
        <VerificationBadge status={item.verification_status} />
        {item.has_contact ? (
          <Badge variant="info">
            <Mail aria-hidden /> Contato disponível
          </Badge>
        ) : null}
      </div>
      {!item.matched_current ? (
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-warning">
          <TriangleAlert className="size-3" aria-hidden /> Corresponde aos filtros por um vínculo ANTERIOR
        </p>
      ) : null}
      <div className="mt-2 space-y-2">
        {item.current_employments.length ? (
          item.current_employments.map((e) => <EmploymentLine key={e.id} employment={e} />)
        ) : (
          <p className="text-sm text-muted-foreground">Sem vínculo atual registrado.</p>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Última confirmação: {formatDate(item.last_verified_at, "nunca confirmado")}
      </p>
    </div>
  );
}
