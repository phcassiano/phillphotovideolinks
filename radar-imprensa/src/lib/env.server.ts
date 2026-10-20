import "server-only";

// Variáveis exclusivas do servidor. Nunca prefixar com NEXT_PUBLIC_.

export type VerificationProviderName = "none" | "demo" | "brave";

export interface IntegrationStatus {
  id: string;
  name: string;
  configured: boolean;
  description: string;
}

function flag(value: string | undefined): boolean {
  return ["1", "true", "on", "yes", "sim"].includes((value ?? "").trim().toLowerCase());
}

export const serverEnv = {
  get serviceRoleKey(): string | undefined {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
  },
  get cronSecret(): string | undefined {
    const value = process.env.CRON_SECRET;
    return value && value.length >= 32 ? value : undefined;
  },
  get verificationProvider(): VerificationProviderName {
    const value = (process.env.VERIFICATION_PROVIDER ?? "none").trim().toLowerCase();
    return value === "demo" || value === "brave" ? value : "none";
  },
  get braveApiKey(): string | undefined {
    return process.env.BRAVE_SEARCH_API_KEY || undefined;
  },
  get featurePautaMatching(): boolean {
    return flag(process.env.FEATURE_PAUTA_MATCHING);
  },
};

// Situação das integrações para a tela de configurações: expõe somente se
// estão configuradas, nunca os valores.
export function getIntegrationStatuses(): IntegrationStatus[] {
  return [
    {
      id: "supabase_service_role",
      name: "Supabase (chave de serviço)",
      configured: Boolean(serverEnv.serviceRoleKey),
      description: "Necessária para o processamento agendado de verificações no servidor.",
    },
    {
      id: "cron_secret",
      name: "Segredo do agendador (CRON_SECRET)",
      configured: Boolean(serverEnv.cronSecret),
      description: "Protege o endpoint /api/cron/verificacoes. Mínimo de 32 caracteres.",
    },
    {
      id: "verification_provider",
      name: `Provedor de verificação: ${serverEnv.verificationProvider}`,
      configured:
        serverEnv.verificationProvider === "demo" ||
        (serverEnv.verificationProvider === "brave" && Boolean(serverEnv.braveApiKey)),
      description:
        "none = desativado; demo = evidências fictícias para testes; brave = Brave Search API (requer BRAVE_SEARCH_API_KEY).",
    },
    {
      id: "pauta_matching",
      name: "Encontrar jornalistas para minha pauta (fase 2)",
      configured: serverEnv.featurePautaMatching,
      description: "Feature flag FEATURE_PAUTA_MATCHING. Desabilitada no MVP.",
    },
  ];
}
