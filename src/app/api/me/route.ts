import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { profileSchema, profileUpdateSchema } from "@/domain/profile";
import { requireApiViewer } from "@/server/auth";
import { assertSameOrigin, errorResponse, privateJSON, readJSON } from "@/server/http";

export const dynamic = "force-dynamic";
export async function GET() {
  try { return privateJSON(await requireApiViewer()); }
  catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const viewer = await requireApiViewer();
    const parsed = profileUpdateSchema.safeParse(await readJSON(request));
    if (!parsed.success) throw new AppError("INVALID_INPUT", 400, "Thông tin hồ sơ chưa hợp lệ. Vui lòng kiểm tra lại.");
    const { data, error } = await createAdminClient().from("users").update(parsed.data).eq("id", viewer.id)
      .select("id,display_name,preferred_mode,timezone,created_at,updated_at").single();
    if (error || !data) throw new AppError("PROFILE_UPDATE_FAILED", 503, "Chưa lưu được thay đổi. Vui lòng thử lại.");
    return privateJSON({ profile: profileSchema.parse(data) });
  } catch (error) { return errorResponse(error); }
}
