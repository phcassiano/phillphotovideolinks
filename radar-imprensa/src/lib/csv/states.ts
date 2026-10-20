import { normalizeText } from "@/lib/identity/names";

export const STATES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso",
  MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

const BY_NAME = new Map(Object.entries(STATES).map(([code, name]) => [normalizeText(name), code]));

// Aceita sigla ("PI") ou nome ("Piauí", "piaui").
export function resolveStateCode(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper in STATES) return upper;
  return BY_NAME.get(normalizeText(raw)) ?? null;
}
