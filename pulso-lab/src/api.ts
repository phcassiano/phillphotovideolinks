import { invoke } from "@tauri-apps/api/core";
import type { Memory, Overview } from "./types";

/** true dentro do app; false quando a interface roda solta no navegador (npm run dev). */
export const isDesktop = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const GB = 1024 ** 3;

// Dados de exemplo para desenhar a interface no navegador, sem o app.
const demo: Overview = {
  osName: "Windows 11 Pro 25H2 (build 26200.6899)",
  hostName: "PC-DEMO",
  cpuName: "Intel(R) Core(TM) i5-10400 CPU @ 2.90GHz",
  cpuCores: 6,
  cpuThreads: 12,
  uptimeSeconds: 9 * 86400 + 3 * 3600,
  memory: { totalBytes: 16 * GB, usedBytes: 11.2 * GB },
  systemDisk: { mountPoint: "C:\\", totalBytes: 237 * GB, freeBytes: 21.4 * GB },
};

export async function getOverview(): Promise<Overview> {
  if (!isDesktop) return structuredClone(demo);
  return invoke<Overview>("system_overview");
}

export async function getMemory(): Promise<Memory> {
  if (!isDesktop) {
    const jitter = (Math.random() - 0.5) * 0.4 * GB;
    return { ...demo.memory, usedBytes: demo.memory.usedBytes + jitter };
  }
  return invoke<Memory>("memory_usage");
}
