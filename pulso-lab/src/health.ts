import { formatBytes, formatUptime, pct } from "./format";
import type { PageId } from "./nav";
import type { Overview } from "./types";

export type CheckStatus = "ok" | "warn" | "bad" | "soon";

export interface Check {
  id: string;
  title: string;
  detail: string;
  status: CheckStatus;
  /** Tela que resolve o problema. */
  fixPage?: PageId;
  /** Versão em que a verificação passa a funcionar (só para status "soon"). */
  version?: string;
}

const PENALTY: Record<CheckStatus, number> = { ok: 0, warn: 12, bad: 30, soon: 0 };

export function buildChecks(o: Overview): Check[] {
  const checks: Check[] = [];

  if (o.systemDisk) {
    const freePct = pct(o.systemDisk.freeBytes, o.systemDisk.totalBytes);
    const free = `${formatBytes(o.systemDisk.freeBytes)} livres (${freePct}%)`;
    checks.push({
      id: "disk-space",
      title: "Espaço no disco do Windows",
      detail: freePct < 10 ? `${free}: pouco espaço deixa o PC lento` : free,
      status: freePct < 10 ? "bad" : freePct < 20 ? "warn" : "ok",
      fixPage: "limpeza",
    });
  }

  const ramPct = pct(o.memory.usedBytes, o.memory.totalBytes);
  checks.push({
    id: "ram",
    title: "Memória RAM",
    detail: `${ramPct}% em uso (${formatBytes(o.memory.usedBytes)} de ${formatBytes(o.memory.totalBytes)})`,
    status: ramPct >= 90 ? "bad" : ramPct >= 80 ? "warn" : "ok",
    fixPage: "otimizacoes",
  });

  const days = o.uptimeSeconds / 86400;
  checks.push({
    id: "uptime",
    title: "Tempo desde a última reinicialização",
    detail:
      days >= 7
        ? `Ligado há ${formatUptime(o.uptimeSeconds)}: reiniciar libera memória e termina atualizações`
        : `Ligado há ${formatUptime(o.uptimeSeconds)}`,
    status: days >= 14 ? "bad" : days >= 7 ? "warn" : "ok",
  });

  const soon: [string, string, string][] = [
    ["junk", "Arquivos inúteis", "0.2"],
    ["startup", "Programas que abrem com o Windows", "0.2"],
    ["tweaks", "Ajustes recomendados do Windows", "0.2"],
    ["drivers", "Drivers", "0.6"],
    ["disk-health", "Saúde dos discos", "0.5"],
    ["outdated", "Programas desatualizados", "0.4"],
  ];
  for (const [id, title, version] of soon) {
    checks.push({ id, title, detail: `Chega na versão ${version}`, status: "soon", version });
  }

  return checks;
}

/** Nota de 0 a 100 considerando só as verificações que já funcionam e não foram ignoradas. */
export function score(checks: Check[], ignored: string[]): number {
  const counted = checks.filter((c) => c.status !== "soon" && !ignored.includes(c.id));
  const total = counted.reduce((sum, c) => sum + PENALTY[c.status], 0);
  return Math.max(0, 100 - total);
}

export function scoreColor(value: number): string {
  if (value >= 85) return "var(--ok)";
  if (value >= 60) return "var(--warn)";
  return "var(--bad)";
}
