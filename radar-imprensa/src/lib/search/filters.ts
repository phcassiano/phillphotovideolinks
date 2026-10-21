import { z } from "zod";
import { OUTLET_TYPES, type OutletType } from "@/lib/domain/enums";

// Filtros da busca avançada, persistidos na URL de /jornalistas.
export const SORT_OPTIONS = ["relevancia", "nome", "verificacao_recente", "atualizacao"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  relevancia: "Relevância",
  nome: "Nome (A–Z)",
  verificacao_recente: "Verificação mais recente",
  atualizacao: "Atualização mais recente",
};

export const PAGE_SIZE = 20;

const uuid = z.uuid();
const STATE_CODES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
export type StateCode = (typeof STATE_CODES)[number];
export const BRAZILIAN_STATES = STATE_CODES;

export interface SearchFilters {
  q?: string;
  editoria?: string; // id da editoria principal
  subeditoria?: string; // id da subeditoria
  uf?: StateCode;
  cidade?: string; // id da localidade (cidade)
  veiculo?: string; // id do veículo
  tipo: OutletType[];
  cargo?: string;
  contato: boolean;
  verificados: boolean;
  atual: boolean; // somente vínculos atuais (padrão: true)
  ordem: SortOption;
  pagina: number;
}

export const DEFAULT_FILTERS: SearchFilters = {
  tipo: [],
  contato: false,
  verificados: false,
  atual: true,
  ordem: "relevancia",
  pagina: 1,
};

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function getAll(params: RawParams, key: string): string[] {
  if (params instanceof URLSearchParams) return params.getAll(key);
  const value = params[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function getOne(params: RawParams, key: string): string | undefined {
  const value = getAll(params, key)[0]?.trim();
  return value ? value : undefined;
}

function optionalUuid(value: string | undefined): string | undefined {
  return value && uuid.safeParse(value).success ? value : undefined;
}

function text(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, max);
  return cleaned.length > 0 ? cleaned : undefined;
}

// Converte parâmetros de URL (possivelmente manipulados) em filtros válidos.
// Valores inválidos são descartados em vez de gerar erro.
export function parseSearchParams(params: RawParams): SearchFilters {
  const ufRaw = getOne(params, "uf")?.toUpperCase();
  const uf = (STATE_CODES as readonly string[]).includes(ufRaw ?? "") ? (ufRaw as StateCode) : undefined;
  const tipos = getAll(params, "tipo")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v): v is OutletType => (OUTLET_TYPES as readonly string[]).includes(v));
  const ordemRaw = getOne(params, "ordem");
  const ordem = (SORT_OPTIONS as readonly string[]).includes(ordemRaw ?? "") ? (ordemRaw as SortOption) : "relevancia";
  const pagina = Number.parseInt(getOne(params, "pagina") ?? "1", 10);

  return {
    q: text(getOne(params, "q"), 120),
    editoria: optionalUuid(getOne(params, "editoria")),
    subeditoria: optionalUuid(getOne(params, "subeditoria")),
    uf,
    cidade: optionalUuid(getOne(params, "cidade")),
    veiculo: optionalUuid(getOne(params, "veiculo")),
    tipo: Array.from(new Set(tipos)),
    cargo: text(getOne(params, "cargo"), 80),
    contato: getOne(params, "contato") === "1",
    verificados: getOne(params, "verificados") === "1",
    atual: getOne(params, "atual") !== "0",
    ordem,
    pagina: Number.isFinite(pagina) && pagina > 0 ? Math.min(pagina, 1000) : 1,
  };
}

// Serializa filtros para a URL, omitindo valores padrão (URLs curtas e compartilháveis).
export function toSearchParams(filters: Partial<SearchFilters>): URLSearchParams {
  const params = new URLSearchParams();
  const merged = { ...DEFAULT_FILTERS, ...filters };
  if (merged.q) params.set("q", merged.q);
  if (merged.editoria) params.set("editoria", merged.editoria);
  if (merged.subeditoria) params.set("subeditoria", merged.subeditoria);
  if (merged.uf) params.set("uf", merged.uf);
  if (merged.cidade) params.set("cidade", merged.cidade);
  if (merged.veiculo) params.set("veiculo", merged.veiculo);
  for (const t of merged.tipo) params.append("tipo", t);
  if (merged.cargo) params.set("cargo", merged.cargo);
  if (merged.contato) params.set("contato", "1");
  if (merged.verificados) params.set("verificados", "1");
  if (!merged.atual) params.set("atual", "0");
  if (merged.ordem !== "relevancia") params.set("ordem", merged.ordem);
  if (merged.pagina > 1) params.set("pagina", String(merged.pagina));
  return params;
}

export function hasActiveFilters(filters: SearchFilters): boolean {
  return Boolean(
    filters.q ||
      filters.editoria ||
      filters.subeditoria ||
      filters.uf ||
      filters.cidade ||
      filters.veiculo ||
      filters.tipo.length ||
      filters.cargo ||
      filters.contato ||
      filters.verificados ||
      !filters.atual,
  );
}

export interface SearchRpcArgs {
  p_query: string | null;
  p_category_ids: string[] | null;
  p_state_code: string | null;
  p_location_id: string | null;
  p_outlet_id: string | null;
  p_outlet_types: OutletType[] | null;
  p_job_title: string | null;
  p_has_contact: boolean;
  p_verified_only: boolean;
  p_current_only: boolean;
  p_sort: SortOption;
  p_page: number;
  p_page_size: number;
}

// Subeditoria é mais específica: quando informada, substitui a editoria principal.
export function toRpcArgs(filters: SearchFilters, pageSize = PAGE_SIZE): SearchRpcArgs {
  const category = filters.subeditoria ?? filters.editoria;
  return {
    p_query: filters.q ?? null,
    p_category_ids: category ? [category] : null,
    p_state_code: filters.uf ?? null,
    p_location_id: filters.cidade ?? null,
    p_outlet_id: filters.veiculo ?? null,
    p_outlet_types: filters.tipo.length ? filters.tipo : null,
    p_job_title: filters.cargo ?? null,
    p_has_contact: filters.contato,
    p_verified_only: filters.verificados,
    p_current_only: filters.atual,
    p_sort: filters.ordem,
    p_page: filters.pagina,
    p_page_size: pageSize,
  };
}

export function totalPages(total: number, pageSize = PAGE_SIZE, maxOffset = 1000): number {
  const reachable = Math.min(total, maxOffset);
  return Math.max(1, Math.ceil(reachable / pageSize));
}
