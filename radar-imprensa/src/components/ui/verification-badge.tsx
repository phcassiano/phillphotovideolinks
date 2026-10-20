import { BadgeCheck, CircleHelp, Clock, Eye, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VerificationStatus } from "@/lib/domain/enums";
import { VERIFICATION_DESCRIPTIONS, VERIFICATION_LABELS } from "@/lib/domain/labels";

const VARIANTS: Record<VerificationStatus, "success" | "info" | "outline" | "warning" | "default"> = {
  confirmado: "success",
  provavel: "info",
  nao_verificado: "outline",
  desatualizado: "warning",
  em_revisao: "default",
};

const ICONS = {
  confirmado: BadgeCheck,
  provavel: Eye,
  nao_verificado: CircleHelp,
  desatualizado: TriangleAlert,
  em_revisao: Clock,
} satisfies Record<VerificationStatus, unknown>;

export function VerificationBadge({ status, className }: { status: VerificationStatus; className?: string }) {
  const Icon = ICONS[status];
  return (
    <Badge variant={VARIANTS[status]} className={className} title={VERIFICATION_DESCRIPTIONS[status]}>
      <Icon aria-hidden />
      {VERIFICATION_LABELS[status]}
    </Badge>
  );
}
