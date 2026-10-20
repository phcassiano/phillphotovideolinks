import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { autoMapColumns, buildPreview, normalizePhone, parseCsv, parseDate, validateRow } from "@/lib/csv/import";
import { resolveStateCode } from "@/lib/csv/states";

const CATEGORIES = [
  { id: "c-politica", name: "Política" },
  { id: "c-cultura", name: "Cultura" },
  { id: "c-economia", name: "Economia" },
  { id: "c-esportes", name: "Esportes" },
  { id: "c-tecnologia", name: "Tecnologia" },
];
const TODAY = new Date("2026-10-20T12:00:00Z");
const example = readFileSync(path.resolve(__dirname, "../../public/exemplos/importacao-exemplo.csv"), "utf8");

describe("importação CSV", () => {
  it("mapeia automaticamente as colunas do modelo", () => {
    const { headers } = parseCsv(example);
    const mapping = autoMapColumns(headers);
    expect(mapping).toMatchObject({
      full_name: "Nome",
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
    });
  });

  it("detecta separador ; e remove BOM", () => {
    const parsed = parseCsv("﻿Nome;Veículo\nFulano Exemplo;Portal Exemplo\n");
    expect(parsed.headers).toEqual(["Nome", "Veículo"]);
    expect(parsed.rows).toHaveLength(1);
  });

  it("valida e normaliza uma linha correta", () => {
    const mapping = autoMapColumns(["Nome", "Veículo", "Editoria", "Estado", "Cidade", "E-mail profissional", "Telefone profissional", "Data da verificação", "Fonte"]);
    const { normalized, errors } = validateRow(
      { Nome: "  Fulana   Exemplo ", Veículo: "Portal X", Editoria: "politica; Cultura", Estado: "Piauí", Cidade: "Teresina", "E-mail profissional": "FULANA@X.EXAMPLE", "Telefone profissional": "(00) 99999-0001", "Data da verificação": "15/09/2026", Fonte: "https://x.example/equipe" },
      mapping,
      CATEGORIES,
      TODAY,
    );
    expect(errors).toEqual([]);
    expect(normalized).toMatchObject({
      full_name: "Fulana Exemplo",
      category_ids: ["c-politica", "c-cultura"],
      state_code: "PI",
      email: "fulana@x.example",
      phone: "+55 (00) 99999-0001",
      verified_at: "2026-09-15",
    });
  });

  it("identifica campos inválidos sem inventar dados", () => {
    const mapping = autoMapColumns(["Nome", "Veículo", "Editoria", "Estado", "E-mail", "Telefone", "Data da verificação"]);
    const { normalized, errors } = validateRow(
      { Nome: "Linha Com Erro", Veículo: "Portal", Editoria: "Inexistente", Estado: "ZZ", "E-mail": "invalido", Telefone: "99999-0001", "Data da verificação": "31/02/2026" },
      mapping,
      CATEGORIES,
      TODAY,
    );
    expect(normalized).toBeNull();
    const fields = errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["categories", "state", "email", "phone", "verified_at"]));
  });

  it("não completa telefones sem DDD", () => {
    expect(normalizePhone("99999-0001")).toBeNull();
    expect(normalizePhone("+55 86 3333-0001")).toBe("+55 (86) 3333-0001");
    expect(normalizePhone("1 2345 6789 0123")).toBeNull();
  });

  it("rejeita datas inexistentes ou futuras", () => {
    expect(parseDate("29/02/2025", TODAY)).toBe("invalid");
    expect(parseDate("01/01/2030", TODAY)).toBe("invalid");
    expect(parseDate("2026-10-01", TODAY)).toBe("2026-10-01");
    expect(parseDate("", TODAY)).toBeNull();
  });

  it("resolve UF por sigla ou nome", () => {
    expect(resolveStateCode("rj")).toBe("RJ");
    expect(resolveStateCode("Sao Paulo")).toBe("SP");
    expect(resolveStateCode("Atlântida")).toBeNull();
  });

  it("gera prévia com deduplicação no arquivo e contra a base", () => {
    const parsed = parseCsv(example + "Tatiana Exemplo Moura;Portal Exemplo Piauí;Portal;Política;PI;Teresina;Repórter;;;;\n");
    const mapping = autoMapColumns(parsed.headers);
    const existing = [
      { id: "j-ana", full_name: "Ana Exemplo Ribeiro", outlet_names: ["Portal Exemplo Piauí"], emails: ["ana.ribeiro@portal-exemplo-pi.example"] },
      { id: "j-vera", full_name: "Vera Modelo Lins", outlet_names: ["Outro Veículo"], emails: [] },
    ];
    const preview = buildPreview(parsed, mapping, CATEGORIES, existing, TODAY);
    const byName = (n: string) => preview.rows.filter((r) => (r.normalized?.full_name ?? r.raw.Nome) === n);

    expect(preview.total).toBe(8);
    expect(preview.invalid).toBe(1);
    // Mesmo e-mail -> vincular ao registro existente
    expect(byName("Ana Exemplo Ribeiro")[0]).toMatchObject({ duplicateOf: "j-ana", action: "vincular" });
    // Nome igual em outro veículo -> apenas alerta de possível homônimo, continua "criar"
    expect(byName("Vera Modelo Lins")[0]).toMatchObject({ duplicateOf: "j-vera", action: "criar" });
    // Repetição no próprio arquivo -> ignorada
    const tatianas = byName("Tatiana Exemplo Moura");
    expect(tatianas).toHaveLength(2);
    expect(tatianas[1]).toMatchObject({ action: "ignorar" });
    expect(tatianas[1]!.duplicateReason).toContain("linha 2");
    // Linha inválida nunca é importada
    expect(byName("Linha Com Erro")[0]).toMatchObject({ action: "ignorar" });
    // Fonte ausente gera alerta
    expect(byName("Xênia Fictícia Alves")[0]!.warnings.map((w) => w.field)).toContain("source");
  });

  it("o arquivo de exemplo usa apenas domínios reservados", () => {
    const emails = example.match(/[\w.+-]+@[\w.-]+/g) ?? [];
    expect(emails.length).toBeGreaterThan(0);
    for (const e of emails) expect(e.endsWith(".example")).toBe(true);
  });
});
