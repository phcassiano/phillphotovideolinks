import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

if (existsSync('.env')) process.loadEnvFile('.env');

export function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (no .env ou no ambiente).');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
