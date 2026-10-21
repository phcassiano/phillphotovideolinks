import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, afterEach } from "vitest";

const url = () =>
  process.env.TEST_DATABASE_URL ??
  `${(process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@localhost:5432/postgres").replace(/\/[^/]*$/, "")}/${process.env.TEST_DB_NAME ?? "radar_imprensa_test"}`;

export const J = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const O = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export interface Db {
  client: pg.Client;
  // Executa como usuário autenticado (simula o PostgREST: set role + claims JWT).
  as<T = Record<string, unknown>>(userId: string | null, sql: string, params?: unknown[]): Promise<T[]>;
  // Executa como superusuário (fora das políticas RLS).
  sys<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  createUser(opts?: { role?: "assessor" | "jornalista" | "admin" | "super_admin"; email?: string; org?: string | null; accountType?: string }): Promise<string>;
  category(slug: string): Promise<string>;
}

// Cada teste roda dentro de uma transação desfeita ao final (isolamento total).
export function setupTestDb(): Db {
  const client = new pg.Client({ connectionString: url() });
  beforeAll(async () => client.connect());
  afterAll(async () => client.end());
  beforeEach(async () => {
    await client.query("begin");
  });
  afterEach(async () => {
    await client.query("rollback");
  });

  const db: Db = {
    client,
    async as(userId, sql, params) {
      await client.query("savepoint as_user");
      try {
        await client.query(`set local role ${userId ? "authenticated" : "anon"}`);
        await client.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify(userId ? { sub: userId, role: "authenticated" } : { role: "anon" }),
        ]);
        const result = await client.query(sql, params);
        await client.query("reset role");
        await client.query("select set_config('request.jwt.claims', '', true)");
        await client.query("release savepoint as_user");
        return result.rows;
      } catch (error) {
        await client.query("rollback to savepoint as_user");
        await client.query("reset role");
        await client.query("select set_config('request.jwt.claims', '', true)");
        throw error;
      }
    },
    async sys(sql, params) {
      return (await client.query(sql, params)).rows;
    },
    async createUser(opts = {}) {
      const id = randomUUID();
      const email = opts.email ?? `${id.slice(0, 8)}@teste.example`;
      await client.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
        id,
        email,
        JSON.stringify({ full_name: `Usuário ${id.slice(0, 4)}`, account_type: opts.accountType ?? (opts.role === "jornalista" ? "jornalista" : "assessor") }),
      ]);
      if (opts.role && opts.role !== "assessor" && opts.role !== "jornalista") {
        await client.query("update public.profiles set role = $2 where id = $1", [id, opts.role]);
      }
      if (opts.org) await client.query("update public.profiles set organization_id = $2 where id = $1", [id, opts.org]);
      return id;
    },
    async category(slug) {
      const rows = await db.sys<{ id: string }>("select id from public.editorial_categories where slug = $1", [slug]);
      return rows[0]!.id;
    },
  };
  return db;
}

export async function expectDenied(promise: Promise<unknown>, pattern: RegExp = /permission denied|row-level security|Acesso|Somente|Autenticação|protegido|não|violates/i) {
  try {
    await promise;
  } catch (error) {
    if (!pattern.test((error as Error).message)) throw new Error(`Erro inesperado: ${(error as Error).message}`);
    return (error as Error).message;
  }
  throw new Error("A operação deveria ter sido negada");
}
