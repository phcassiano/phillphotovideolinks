function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}. Veja .env.example.`);
  return value;
}

export const serverEnv = {
  get siteUrl() {
    return (process.env.SITE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  },
  get supabaseUrl() {
    return required('SUPABASE_URL');
  },
  get supabaseAnonKey() {
    return required('SUPABASE_ANON_KEY');
  },
  get serviceRoleKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get metricsSalt() {
    return process.env.METRICS_SALT ?? 'perto-dev-salt';
  },
};

/** Somente o que o navegador pode ver. */
export function publicEnv() {
  return {
    SUPABASE_URL: serverEnv.supabaseUrl,
    SUPABASE_ANON_KEY: serverEnv.supabaseAnonKey,
    SITE_URL: serverEnv.siteUrl,
  };
}
export type PublicEnv = ReturnType<typeof publicEnv>;
