import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";
import type { Database } from "@/lib/db.types";

// Chỉ DAL đã xác thực mới dùng client bypass RLS này. Không export singleton ra client.
export function createAdminClient() {
  const { url, secret } = getServerEnv();
  return createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
