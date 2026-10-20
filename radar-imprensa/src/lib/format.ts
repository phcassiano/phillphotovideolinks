const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function formatDate(value: string | Date | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  const date = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value) : value;
  return Number.isNaN(date.getTime()) ? fallback : dateFormatter.format(date);
}

export function formatDateTime(value: string | Date | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? fallback : dateTimeFormatter.format(date);
}

export function relativeDays(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return "nunca";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const days = Math.round((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "há 1 dia";
  if (days < 60) return `há ${days} dias`;
  const months = Math.round(days / 30);
  return months < 24 ? `há ${months} meses` : `há ${Math.round(days / 365)} anos`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}
