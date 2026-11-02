import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/db.types";

export async function createServerSupabaseClient() {
  const { url, key } = getPublicEnv();
  const store = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: values => {
        try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* RSC không ghi cookie. Proxy đã refresh session trước khi render. */ }
      },
    },
  });
}
