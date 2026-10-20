import { resetDatabase } from "../../scripts/db-local.mjs";

// Recria o banco de teste (shim do Supabase + migrations + seed) uma vez por execução.
export default async function setup() {
  try {
    process.env.TEST_DATABASE_URL = await resetDatabase({ seed: true });
  } catch (error) {
    throw new Error(
      `Não foi possível preparar o PostgreSQL de teste (${(error as Error).message}). ` +
        "Defina DATABASE_URL_TEST=postgres://usuario:senha@host:5432/postgres apontando para um PostgreSQL 15+ com as extensões pg_trgm e unaccent.",
    );
  }
}
