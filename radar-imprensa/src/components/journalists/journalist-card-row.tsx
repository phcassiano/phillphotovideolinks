import Link from "next/link";
import { VerificationBadge } from "@/components/ui/verification-badge";
import type { JournalistCard } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { EmploymentLine } from "./employment-line";

export function JournalistCardRow({ card, children }: { card: JournalistCard; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-surface p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {card.is_available ? (
            <Link href={`/jornalistas/${card.id}`} className="font-semibold text-primary hover:underline">
              {card.full_name}
            </Link>
          ) : (
            <span className="font-semibold text-muted-foreground">{card.full_name}</span>
          )}
          <VerificationBadge status={card.verification_status} />
        </div>
        {!card.is_available ? (
          <p className="mt-1 text-xs text-warning">Perfil indisponível (oculto a pedido do titular ou unificado a outro registro).</p>
        ) : (
          <div className="mt-2 space-y-1">
            {card.current_employments.length ? (
              card.current_employments.map((e) => <EmploymentLine key={e.id} employment={e} compact />)
            ) : (
              <p className="text-sm text-muted-foreground">Sem vínculo atual registrado.</p>
            )}
          </div>
        )}
        <p className="mt-1 text-xs text-muted-foreground">Última confirmação: {formatDate(card.last_verified_at, "nunca")}</p>
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-start gap-2">{children}</div> : null}
    </div>
  );
}
