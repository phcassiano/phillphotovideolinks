// Recria um banco PostgreSQL local com o shim do Supabase, as migrations e
// (opcionalmente) o seed demonstrativo. Usado pelos testes de banco.
//
//   DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/postgres node scripts/db-local.mjs reset [--seed]
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const adminUrl = process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@localhost:5432/postgres";
const dbName = process.env.TEST_DB_NAME ?? "radar_imprensa_test";

export async function resetDatabase({ seed = true } = {}) {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${dbName} with (force)`);
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const url = new URL(adminUrl);
  url.pathname = `/${dbName}`;
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await client.query(readFileSync(path.join(root, "tests/db/supabase-shim.sql"), "utf8"));
    const dir = path.join(root, "supabase/migrations");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      try {
        await client.query(readFileSync(path.join(dir, file), "utf8"));
      } catch (error) {
        throw new Error(`Falha na migration ${file}: ${error.message}`);
      }
    }
    if (seed) {
      await client.query(readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));
    }
  } finally {
    await client.end();
  }
  return url.toString();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const seed = process.argv.includes("--seed");
  resetDatabase({ seed })
    .then((url) => console.log(`Banco recriado: ${url}`))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
