import type { ExportRow } from "@/lib/domain/types";
import { VERIFICATION_LABELS } from "@/lib/domain/labels";
import { formatDate } from "@/lib/format";

// Protege contra injeção de fórmulas em planilhas (CSV injection / OWASP).
export function sanitizeCell(value: string | null | undefined): string {
  let v = (value ?? "").replace(/\r?\n/g, " ");
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// Telefones validados no banco começam com "+": exporta sem o sinal para que
// planilhas não interpretem o valor como fórmula.
function phoneCell(value: string | null): string {
  return (value ?? "")
    .split("; ")
    .map((p) => p.replace(/^\+/, ""))
    .join("; ");
}

export const EXPORT_HEADERS = [
  "Nome",
  "Nome profissional",
  "Veículos atuais",
  "Cargos",
  "Localidades",
  "Editorias",
  "E-mail profissional",
  "Telefone profissional (com DDI)",
  "Formulário de contato",
  "Situação da verificação",
  "Última confirmação",
  "Notas privadas",
];

export function buildExportCsv(rows: ExportRow[]): string {
  const lines = [EXPORT_HEADERS.map(sanitizeCell).join(";")];
  for (const r of rows) {
    lines.push(
      [
        r.full_name,
        r.professional_name,
        r.outlet_names,
        r.job_titles,
        r.locations,
        r.categories,
        r.email,
        phoneCell(r.phone),
        r.contact_form,
        VERIFICATION_LABELS[r.verification_status],
        formatDate(r.last_verified_at, "Nunca"),
        r.notes,
      ]
        .map(sanitizeCell)
        .join(";"),
    );
  }
  // BOM para que o Excel reconheça UTF-8.
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function safeFileName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);
  return `${base || "mailing"}.csv`;
}
