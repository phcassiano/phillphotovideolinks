import { describe, expect, it } from "vitest";
import { buildExportCsv, safeFileName, sanitizeCell } from "@/lib/csv/export";
import type { ExportRow } from "@/lib/domain/types";

const row: ExportRow = {
  journalist_id: "1",
  full_name: "Ana Exemplo",
  professional_name: null,
  outlet_names: "Portal; Jornal",
  job_titles: "Repórter",
  locations: "Teresina/PI",
  categories: "Política",
  email: "ana@x.example",
  phone: "+55 (00) 90000-0001",
  contact_form: null,
  verification_status: "confirmado",
  last_verified_at: "2026-10-01T12:00:00Z",
  notes: '=HYPERLINK("http://mal.example")',
};

describe("exportação CSV", () => {
  it("neutraliza fórmulas (injeção em planilhas)", () => {
    expect(sanitizeCell("=1+1")).toBe("'=1+1");
    expect(sanitizeCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(sanitizeCell("-2")).toBe("'-2");
    expect(sanitizeCell("texto normal")).toBe("texto normal");
    expect(sanitizeCell('a;"b"')).toBe('"a;""b"""');
  });

  it("gera CSV com BOM, cabeçalho e telefone sem sinal de fórmula", () => {
    const csv = buildExportCsv([row]);
    expect(csv.startsWith("﻿Nome;")).toBe(true);
    const line = csv.split("\r\n")[1]!;
    expect(line).toContain("55 (00) 90000-0001");
    expect(line).not.toContain(";+55");
    expect(line).toContain("Confirmado");
    expect(line).toContain(`"'=HYPERLINK(""http://mal.example"")"`);
  });

  it("gera nomes de arquivo seguros", () => {
    expect(safeFileName("Política — Brasília")).toBe("politica-brasilia.csv");
    expect(safeFileName("../../etc/passwd")).toBe("etcpasswd.csv");
    expect(safeFileName("")).toBe("mailing.csv");
  });
});
