import { describe, expect, it } from "vitest";
import { setupTestDb } from "./helpers";

const db = setupTestDb();

// Corpos plpgsql só falham em tempo de execução: exercita as RPCs restantes.
describe("RPCs auxiliares", () => {
  it("painel administrativo", async () => {
    const admin = await db.createUser({ role: "admin" });
    const [r] = await db.as<{ s: Record<string, unknown> & { by_status: Record<string, number> } }>(admin, "select public.admin_dashboard_stats() as s");
    expect(r!.s.journalists_total).toBe(20);
    expect(r!.s.by_status.confirmado).toBeGreaterThan(0);
    expect(r!.s).toHaveProperty("review_overdue");
  });

  it("busca de veículos com tolerância a acentos", async () => {
    const u = await db.createUser();
    const rows = await db.as<{ name: string }>(u, "select * from public.search_outlets('gazeta ficticia')");
    expect(rows[0]!.name).toBe("Gazeta Fictícia do Piauí");
  });

  it("limpeza de eventos de limite de uso (tarefa agendada)", async () => {
    const [r] = await db.sys<{ n: number }>("select public.prune_rate_limit_events() as n");
    expect(r!.n).toBeGreaterThanOrEqual(0);
    const u = await db.createUser();
    await expect(db.as(u, "select public.prune_rate_limit_events()")).rejects.toThrow(/Acesso negado/);
  });

  it("agendamentos rodam em contexto de sistema (pg_cron) sem usuário", async () => {
    const [r] = await db.sys<{ n: number }>("select public.schedule_due_verifications(5) as n");
    expect(r!.n).toBeLessThanOrEqual(5);
  });
});
