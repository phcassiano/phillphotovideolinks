import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { createServiceClient } from "@/lib/supabase/service";
import { createVerificationService } from "@/lib/verification/factory";

// Processa um lote pequeno de verificações. Chamado pela Edge Function
// `verification-dispatch` (Supabase Cron) ou por outro agendador, com
// Authorization: Bearer <CRON_SECRET>.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = serverEnv.cronSecret;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const db = createServiceClient();
  if (!db) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { batchSize?: number; schedule?: boolean };
  const batchSize = Math.min(Math.max(Number(body.batchSize) || 10, 1), 50);

  let scheduled: number | null = null;
  if (body.schedule) {
    const { data, error } = await db.rpc("schedule_due_verifications", { p_limit: null });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    scheduled = data as number;
  }

  const service = createVerificationService(db, { provider: serverEnv.verificationProvider, braveApiKey: serverEnv.braveApiKey });
  try {
    const report = await service.runBatch(batchSize);
    return NextResponse.json({ provider: serverEnv.verificationProvider, scheduled, ...report, details: undefined });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "erro" }, { status: 500 });
  }
}
