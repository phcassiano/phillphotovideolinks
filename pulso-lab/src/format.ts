export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1000) return `${(gb / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} TB`;
  if (gb >= 1) return `${gb.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} MB`;
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d} dia${d > 1 ? "s" : ""} e ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
