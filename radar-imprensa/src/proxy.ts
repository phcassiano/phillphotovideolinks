import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requiredPermissionFor } from "@/lib/auth/permissions";
import { updateSession } from "@/lib/supabase/proxy";

// Primeira barreira: exige sessão nas áreas autenticadas. A checagem de papel
// é refeita nos layouts/ações (servidor) e, de forma definitiva, no banco (RLS).
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protectedRoute = requiredPermissionFor(pathname) !== null;

  if (!isSupabaseConfigured()) {
    if (protectedRoute) {
      return NextResponse.redirect(new URL("/configuracao-necessaria", request.url));
    }
    return NextResponse.next();
  }

  const { response, userId } = await updateSession(request);
  if (protectedRoute && !userId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (userId && (pathname === "/login" || pathname === "/cadastro")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|csv)$).*)"],
};
