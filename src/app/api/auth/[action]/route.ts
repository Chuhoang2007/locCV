import { authErrorMessage, forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from "@/domain/auth";
import { getSiteOrigin, isAccountConfigured } from "@/lib/env";
import { AppError, configurationError } from "@/lib/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertSameOrigin, errorResponse, privateJSON, readJSON } from "@/server/http";

export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    assertSameOrigin(request);
    const { action } = await context.params;
    if (!["login", "signup", "forgot-password", "reset-password", "logout"].includes(action)) throw new AppError("NOT_FOUND", 404, "Không tìm thấy thao tác này.");
    if (!isAccountConfigured()) throw configurationError();
    const client = await createServerSupabaseClient();
    if (action === "logout") {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw new AppError("SIGNOUT_FAILED", 503, "Chưa đăng xuất được. Vui lòng thử lại.");
      return privateJSON({ redirect: "/login" });
    }
    const body = await readJSON(request);
    if (action === "login") {
      const parsed = loginSchema.safeParse(body);
      if (!parsed.success) throw new AppError("INVALID_INPUT", 400, "Vui lòng kiểm tra email và mật khẩu.");
      const { error } = await client.auth.signInWithPassword(parsed.data);
      if (error) throw new AppError("AUTH_FAILED", 400, authErrorMessage(error.code));
      return privateJSON({ redirect: "/settings" });
    }
    if (action === "signup") {
      const parsed = signupSchema.safeParse(body);
      if (!parsed.success) throw new AppError("INVALID_INPUT", 400, "Vui lòng kiểm tra tên, email và mật khẩu.");
      const { display_name, email, password } = parsed.data;
      const { data, error } = await client.auth.signUp({ email, password, options: {
        data: { display_name }, emailRedirectTo: `${getSiteOrigin()}/auth/callback`,
      } });
      if (error && error.code !== "user_already_exists") throw new AppError("SIGNUP_FAILED", 400, authErrorMessage(error.code));
      if (data.session) return privateJSON({ redirect: "/settings" });
      return privateJSON({ message: "Nếu địa chỉ email có thể đăng ký, bạn sẽ nhận được thư xác nhận. Hãy kiểm tra hộp thư và thư rác." });
    }
    if (action === "forgot-password") {
      const parsed = forgotPasswordSchema.safeParse(body);
      if (!parsed.success) throw new AppError("INVALID_INPUT", 400, "Vui lòng nhập email hợp lệ.");
      const { error } = await client.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: `${getSiteOrigin()}/auth/callback?flow=recovery`,
      });
      if (error) throw new AppError("RECOVERY_FAILED", 400, authErrorMessage(error.code));
      return privateJSON({ message: "Nếu email đã có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu. Hãy kiểm tra hộp thư và thư rác." });
    }
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) throw new AppError("UNAUTHENTICATED", 401, "Liên kết đặt lại mật khẩu đã hết hạn. Hãy yêu cầu liên kết mới.");
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) throw new AppError("INVALID_INPUT", 400, "Mật khẩu mới cần ít nhất 12 ký tự và hai lần nhập phải khớp.");
    const { error } = await client.auth.updateUser({ password: parsed.data.password });
    if (error) throw new AppError("PASSWORD_UPDATE_FAILED", 400, authErrorMessage(error.code));
    const { error: signOutError } = await client.auth.signOut({ scope: "global" });
    if (signOutError) return privateJSON({ redirect: "/settings?password_changed=1&signout_pending=1" });
    return privateJSON({ redirect: "/login?updated=1" });
  } catch (error) { return errorResponse(error); }
}
