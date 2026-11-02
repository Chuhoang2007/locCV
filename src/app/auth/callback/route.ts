import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/env";
import { safeNextPath } from "@/domain/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const target = request.nextUrl.searchParams.get("flow") === "recovery" ? "/reset-password" : safeNextPath(request.nextUrl.searchParams.get("next"));
  if (code) {
    try {
      const client = await createServerSupabaseClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(target, getSiteOrigin()), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    } catch { /* Không đưa lỗi provider/code vào URL hoặc log. */ }
  }
  return NextResponse.redirect(new URL("/login?link_error=1", getSiteOrigin()), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
