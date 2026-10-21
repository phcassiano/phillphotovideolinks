import Papa from "papaparse";
import { z } from "zod";
import { OUTLET_TYPES, type OutletType } from "@/lib/domain/enums";
import { nameSimilarity, normalizeText } from "@/lib/identity/names";
import { resolveStateCode } from "./states";

// -----------------------------------------------------------------------------
// Colunas aceitas e mapeamento automático
// -----------------------------------------------------------------------------
export const IMPORT_FIELDS = [
  "full_name",
  "professional_name",
  "outlet_name",
  "outlet_type",
  "categories",
  "state",
  "city",
  "job_title",
  "email",
  "phone",
  "source",
  "verified_at",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  full_name: "Nome",
  professional_name: "Nome profissional",
  outlet_name: "Veículo",
  outlet_type: "Tipo de veículo",
  categories: "Editoria",
  state: "Estado",
  city: "Cidade",
  job_title: "Cargo",
  email: "E-mail profissional",
  phone: "Telefone profissional",
  source: "Fonte",
  verified_at: "Data da verificação",
};

export const REQUIRED_FIELDS: ImportField[] = ["full_name", "outlet_name"];

const ALIASES: Record<ImportField, string[]> = {
  full_name: ["nome", "nome completo", "jornalista", "name"],
  professional_name: ["nome profissional", "assinatura", "nome de guerra"],
  outlet_name: ["veiculo", "veiculo de comunicacao", "midia", "empresa", "outlet"],
  outlet_type: ["tipo de veiculo", "tipo", "tipo de midia"],
  categories: ["editoria", "editorias", "subeditoria", "area", "editoria/subeditoria"],
  state: ["estado", "uf"],
  city: ["cidade", "municipio"],
  job_title: ["cargo", "funcao", "cargo/funcao"],
  email: ["e-mail profissional", "email profissional", "e-mail", "email"],
  phone: ["telefone profissional", "telefone", "fone", "celular profissional"],
  source: ["fonte", "fonte da informacao", "url da fonte", "origem"],
  verified_at: ["data da verificacao", "data verificacao", "verificado em", "data"],
};

export type ColumnMapping = Partial<Record<ImportField, string>>;

// Mapeamento parcial: só as colunas presentes no arquivo são informadas.
export const mappingSchema = z.partialRecord(z.enum(IMPORT_FIELDS), z.string().max(200)).transform((m) => m as ColumnMapping);

export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  for (const field of IMPORT_FIELDS) {
    const header = headers.find((h) => !used.has(h) && ALIASES[field].includes(normalizeText(h)));
    if (header) {
      mapping[field] = header;
      used.add(header);
    }
  }
  return mapping;
}

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
}

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export function parseCsv(content: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(content.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
    delimitersToGuess: [",", ";", "\t", "|"],
  });
  const errors = result.errors.slice(0, 20).map((e) => `Linha ${(e.row ?? 0) + 2}: ${e.message}`);
  if (result.data.length > MAX_IMPORT_ROWS) {
    errors.unshift(`O arquivo tem ${result.data.length} linhas; o máximo por importação é ${MAX_IMPORT_ROWS}.`);
  }
  return {
    headers: (result.meta.fields ?? []).filter((h) => h.length > 0),
    rows: result.data.slice(0, MAX_IMPORT_ROWS),
    errors,
  };
}

// -----------------------------------------------------------------------------
// Validação e normalização por linha
// -----------------------------------------------------------------------------
export interface CategoryOption {
  id: string;
  name: string;
  parent_name?: string | null;
}

export interface NormalizedRow {
  full_name: string;
  professional_name: string | null;
  outlet_name: string;
  outlet_type: OutletType | null;
  category_ids: string[];
  state_code: string | null;
  city_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  verified_at: string | null;
}

export interface RowIssue {
  field: ImportField | "*";
  message: string;
}

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

// Normaliza telefone brasileiro. Exige DDD: números incompletos são rejeitados
// (nunca completamos ou inferimos dígitos).
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  let national = digits;
  if (digits.length === 12 || digits.length === 13) {
    if (!digits.startsWith("55")) return null;
    national = digits.slice(2);
  }
  if (national.length !== 10 && national.length !== 11) return null;
  const ddd = national.slice(0, 2);
  const rest = national.slice(2);
  const split = rest.length === 9 ? 5 : 4;
  return `+55 (${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

export function parseDate(value: string, today: Date = new Date()): string | null | "invalid" {
  const v = value.trim();
  if (!v) return null;
  let y: number, m: number, d: number;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (br) [d, m, y] = [Number(br[1]), Number(br[2]), Number(br[3])];
  else if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else return "invalid";
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return "invalid";
  if (date.getTime() > today.getTime() + 86_400_000 || y < 1950) return "invalid";
  return date.toISOString().slice(0, 10);
}

const OUTLET_TYPE_ALIASES: Record<string, OutletType> = {
  tv: "tv", televisao: "tv", radio: "radio", jornal: "jornal", "jornal impresso": "jornal",
  portal: "portal", site: "portal", "portal de noticias": "portal", revista: "revista",
  agencia: "agencia", "agencia de noticias": "agencia", independente: "independente",
  blog: "independente", podcast: "independente", newsletter: "independente",
};

const textField = (max: number) =>
  z.string().transform((s) => s.replace(/\s+/g, " ").trim()).pipe(z.string().max(max, `Máximo de ${max} caracteres`));

const baseRowSchema = z.object({
  full_name: textField(160).pipe(z.string().min(3, "Nome obrigatório (mínimo 3 caracteres)")),
  professional_name: textField(160),
  outlet_name: textField(160).pipe(z.string().min(2, "Veículo obrigatório")),
  outlet_type: textField(40),
  categories: textField(300),
  state: textField(40),
  city: textField(120),
  job_title: textField(120),
  email: textField(300),
  phone: textField(40),
  source: textField(500),
  verified_at: textField(20),
});

export function validateRow(
  raw: Record<string, string>,
  mapping: ColumnMapping,
  categories: CategoryOption[],
  today: Date = new Date(),
): { normalized: NormalizedRow | null; errors: RowIssue[]; warnings: RowIssue[] } {
  const values = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, mapping[f] ? raw[mapping[f]!] ?? "" : ""]));
  const parsed = baseRowSchema.safeParse(values);
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({ field: (issue.path[0] as ImportField) ?? "*", message: issue.message });
    }
    return { normalized: null, errors, warnings };
  }
  const v = parsed.data;

  let outletType: OutletType | null = null;
  if (v.outlet_type) {
    outletType = OUTLET_TYPE_ALIASES[normalizeText(v.outlet_type)] ??
      ((OUTLET_TYPES as readonly string[]).includes(normalizeText(v.outlet_type)) ? (normalizeText(v.outlet_type) as OutletType) : null);
    if (!outletType) errors.push({ field: "outlet_type", message: `Tipo de veículo não reconhecido: "${v.outlet_type}"` });
  }

  const categoryIds: string[] = [];
  if (v.categories) {
    for (const name of v.categories.split(/[;|/,]/).map((s) => s.trim()).filter(Boolean)) {
      const match = categories.find((c) => normalizeText(c.name) === normalizeText(name));
      if (match) categoryIds.push(match.id);
      else errors.push({ field: "categories", message: `Editoria não reconhecida: "${name}"` });
    }
  } else {
    warnings.push({ field: "categories", message: "Sem editoria: o registro não aparecerá em buscas por editoria." });
  }

  let stateCode: string | null = null;
  if (v.state) {
    stateCode = resolveStateCode(v.state);
    if (!stateCode) errors.push({ field: "state", message: `Estado inválido: "${v.state}"` });
  } else if (v.city) {
    errors.push({ field: "state", message: "Informe o estado quando a cidade for preenchida." });
  }

  let email: string | null = null;
  if (v.email) {
    email = v.email.toLowerCase();
    if (!EMAIL_RE.test(email)) {
      errors.push({ field: "email", message: "E-mail inválido" });
      email = null;
    }
  }

  let phone: string | null = null;
  if (v.phone) {
    phone = normalizePhone(v.phone);
    if (!phone) errors.push({ field: "phone", message: "Telefone inválido ou sem DDD (não completamos números)." });
  }

  let verifiedAt: string | null = null;
  if (v.verified_at) {
    const d = parseDate(v.verified_at, today);
    if (d === "invalid") errors.push({ field: "verified_at", message: "Data inválida (use DD/MM/AAAA)" });
    else verifiedAt = d;
  }

  if (!v.source) {
    warnings.push({ field: "source", message: "Sem fonte: a origem dos dados não poderá ser comprovada." });
  } else if (/^https?:\/\//i.test(v.source)) {
    try {
      new URL(v.source);
    } catch {
      errors.push({ field: "source", message: "URL da fonte inválida" });
    }
  }
  if ((email || phone) && !v.source) {
    warnings.push({ field: "*", message: "Contato sem fonte: será importado como restrito e não verificado." });
  }

  if (errors.length) return { normalized: null, errors, warnings };
  return {
    normalized: {
      full_name: v.full_name,
      professional_name: v.professional_name || null,
      outlet_name: v.outlet_name,
      outlet_type: outletType,
      category_ids: Array.from(new Set(categoryIds)),
      state_code: stateCode,
      city_name: v.city || null,
      job_title: v.job_title || null,
      email,
      phone,
      source: v.source || null,
      verified_at: verifiedAt,
    },
    errors,
    warnings,
  };
}

// -----------------------------------------------------------------------------
// Deduplicação
// -----------------------------------------------------------------------------
export interface ExistingCandidate {
  id: string;
  full_name: string;
  outlet_names: string[];
  emails: string[];
}

export type RowAction = "criar" | "vincular" | "ignorar";

export interface PreviewRow {
  rowNumber: number; // número da linha no arquivo (cabeçalho = 1)
  raw: Record<string, string>;
  normalized: NormalizedRow | null;
  errors: RowIssue[];
  warnings: RowIssue[];
  duplicateOf: string | null;
  duplicateReason: string | null;
  action: RowAction;
}

export interface ImportPreview {
  rows: PreviewRow[];
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
}

export function buildPreview(
  parsed: ParsedCsv,
  mapping: ColumnMapping,
  categories: CategoryOption[],
  existing: ExistingCandidate[],
  today: Date = new Date(),
): ImportPreview {
  const seen = new Map<string, number>();
  const rows: PreviewRow[] = parsed.rows.map((raw, index) => {
    const rowNumber = index + 2;
    const { normalized, errors, warnings } = validateRow(raw, mapping, categories, today);
    const row: PreviewRow = {
      rowNumber, raw, normalized, errors, warnings, duplicateOf: null, duplicateReason: null,
      action: errors.length ? "ignorar" : "criar",
    };
    if (!normalized) return row;

    // Duplicidade dentro do próprio arquivo
    const key = `${normalizeText(normalized.full_name)}|${normalizeText(normalized.outlet_name)}`;
    const firstRow = seen.get(key);
    if (firstRow !== undefined) {
      row.action = "ignorar";
      row.duplicateReason = `Repete a linha ${firstRow} (mesmo nome e veículo)`;
      return row;
    }
    seen.set(key, rowNumber);

    // Duplicidade com a base existente
    const outletKey = normalizeText(normalized.outlet_name);
    let best: { candidate: ExistingCandidate; reason: string; strong: boolean } | null = null;
    for (const candidate of existing) {
      if (normalized.email && candidate.emails.includes(normalized.email)) {
        best = { candidate, reason: "Mesmo e-mail profissional já cadastrado", strong: true };
        break;
      }
      const similarity = nameSimilarity(normalized.full_name, candidate.full_name);
      if (similarity < 0.85) continue;
      const sameOutlet = candidate.outlet_names.some((o) => normalizeText(o) === outletKey);
      if (sameOutlet && similarity >= 0.9) {
        best = { candidate, reason: "Nome semelhante no mesmo veículo", strong: true };
      } else if (!best) {
        best = { candidate, reason: "Nome semelhante em outro veículo: possível homônimo, confira antes de vincular", strong: false };
      }
    }
    if (best) {
      row.duplicateOf = best.candidate.id;
      row.duplicateReason = best.reason;
      // Somente correspondências fortes sugerem vínculo; o administrador decide na prévia.
      row.action = best.strong ? "vincular" : "criar";
    }
    return row;
  });

  return {
    rows,
    total: rows.length,
    valid: rows.filter((r) => r.errors.length === 0).length,
    invalid: rows.filter((r) => r.errors.length > 0).length,
    duplicates: rows.filter((r) => r.duplicateOf || r.duplicateReason).length,
  };
}
