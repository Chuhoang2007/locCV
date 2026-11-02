import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPublicEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { profileSchema } from "@/domain/profile";
import type { ViewerDTO } from "@/domain/dto";

export const getSessionUser = cache(async () => {
  if (!hasPublicEnv()) return null;
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error && (error.status ?? 0) >= 500) throw new AppError("AUTH_UNAVAILABLE", 503, "Chưa thể kết nối dịch vụ tài khoản. Vui lòng thử lại.");
  return error ? null : data.user;
});

export const getViewer = cache(async (): Promise<ViewerDTO | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const { data, error } = await createAdminClient().from("users")
    .select("id,display_name,preferred_mode,timezone,created_at,updated_at").eq("id", user.id).maybeSingle();
  if (error || !data) throw new AppError("PROFILE_UNAVAILABLE", 503, "Chưa thể tải hồ sơ tài khoản. Vui lòng thử lại sau.");
  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) throw new AppError("PROFILE_UNAVAILABLE", 503, "Chưa thể tải hồ sơ tài khoản.");
  return { id: user.id, email: user.email ?? "", profile: parsed.data };
});

export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export async function requireApiViewer() {
  const viewer = await getViewer();
  if (!viewer) throw new AppError("UNAUTHENTICATED", 401, "Vui lòng đăng nhập để tiếp tục.");
  return viewer;
}

export function requireOwnership(ownerId: string, actorId: string) {
  if (ownerId !== actorId) throw new AppError("NOT_FOUND", 404, "Không tìm thấy nội dung này.");
}
