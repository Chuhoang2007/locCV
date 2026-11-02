"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db.types";

// Chỉ dành cho Auth/realtime tương lai; không có quyền đọc bảng nghiệp vụ trực tiếp.
export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || key.startsWith("sb_secret_")) throw new Error("Dịch vụ tài khoản chưa sẵn sàng.");
  return createBrowserClient<Database>(url, key);
}
