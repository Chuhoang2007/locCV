import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/env";

// Dành cho email template token_hash. Hỗ trợ mở email trên thiết bị khác với lúc đăng ký.
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (tokenHash && (type === "email" || type === "signup" || type === "recovery")) {
    try {
      const client = await createServerSupabaseClient();
      const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return NextResponse.redirect(new URL(type === "recovery" ? "/reset-password" : "/settings", getSiteOrigin()), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    } catch { /* Thất bại an toàn, không phản chiếu token. */ }
  }
  return NextResponse.redirect(new URL("/login?link_error=1", getSiteOrigin()), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
