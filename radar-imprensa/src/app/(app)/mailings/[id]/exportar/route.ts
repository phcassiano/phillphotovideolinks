import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildExportCsv, safeFileName } from "@/lib/csv/export";
import type { ExportRow } from "@/lib/domain/types";
import { can } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/session";
import { friendlyDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

// Exportação autorizada: o banco valida acesso à lista, aplica limite por hora,
// filtra contatos permitidos e registra a exportação em auditoria.
export async function GET(request: NextRequest, ctx: RouteContext<"/mailings/[id]/exportar">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Lista inválida", { status: 400 });
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!can(user.role, "mailings.manage")) return new NextResponse("Acesso negado", { status: 403 });

  const supabase = await createClient();
  const { data: mailing } = await supabase.from("mailing_lists").select("name").eq("id", id).maybeSingle();
  if (!mailing) return new NextResponse("Lista não encontrada", { status: 404 });

  const { data, error } = await supabase.rpc("export_mailing_contacts", { p_mailing_id: id });
  if (error) {
    const friendly = friendlyDbError(error);
    const url = new URL(`/mailings/${id}`, request.url);
    url.searchParams.set("erro", friendly.message);
    return NextResponse.redirect(url);
  }

  const csv = buildExportCsv((data ?? []) as ExportRow[]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFileName(mailing.name as string)}"`,
      "Cache-Control": "no-store",
    },
  });
}
