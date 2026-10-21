import type { ChangeOp } from "@/lib/confidence/policy";

// Descreve operações de proposta em linguagem natural para o revisor.
export function describeChange(op: ChangeOp, names: { outlets: Map<string, string>; employments: Map<string, string> }): string {
  switch (op.op) {
    case "confirm_current":
      return "Confirmar os vínculos atuais";
    case "set_field":
      return `Alterar ${op.field} para “${op.value}”`;
    case "set_verification_status":
      return `Definir situação como ${op.value}`;
    case "end_employment":
      return `Encerrar vínculo: ${names.employments.get(op.employment_id) ?? op.employment_id}${op.end_date ? ` em ${op.end_date}` : ""}`;
    case "add_employment":
      return `Novo vínculo: ${op.job_title ?? "cargo não informado"} no ${names.outlets.get(op.media_outlet_id) ?? op.media_outlet_id}`;
    case "add_contact":
      return `Novo contato (${op.contact_type}): ${op.contact_value} — ${op.visibility ?? "restrito"}`;
    case "update_contact_status":
      return `Marcar contato como ${op.verification_status}`;
    case "add_topic":
      return `Adicionar tema “${op.topic_name}”`;
  }
}

export function ChangeList({ changes, names }: { changes: ChangeOp[]; names: { outlets: Map<string, string>; employments: Map<string, string> } }) {
  if (changes.length === 0) return <p className="text-sm text-muted-foreground">Sem operações estruturadas (sugestão em texto livre).</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {changes.map((c, i) => <li key={i}>{describeChange(c, names)}</li>)}
    </ul>
  );
}
