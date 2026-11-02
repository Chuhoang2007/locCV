import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv, hasPublicEnv } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  if (!hasPublicEnv()) return response;
  const { url, key } = getPublicEnv();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: values => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  // Chỉ refresh/kiểm tra JWT. DAL vẫn xác minh getUser và ownership độc lập.
  try { await client.auth.getClaims(); }
  catch { /* Không cấp quyền từ cookie nếu provider lỗi; DAL sẽ từ chối. */ }
  return response;
}
