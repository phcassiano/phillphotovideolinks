export interface Memory {
  totalBytes: number;
  usedBytes: number;
}

export interface SystemDisk {
  mountPoint: string;
  totalBytes: number;
  freeBytes: number;
}

export interface Overview {
  osName: string;
  hostName: string;
  cpuName: string;
  cpuCores: number;
  cpuThreads: number;
  uptimeSeconds: number;
  memory: Memory;
  systemDisk: SystemDisk | null;
}
