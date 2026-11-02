import { z } from "zod";

const email = z.string().trim().max(254).toLowerCase().pipe(z.email("Email chưa đúng định dạng."));
export const passwordSchema = z.string().min(12, "Mật khẩu cần ít nhất 12 ký tự.").max(128, "Mật khẩu tối đa 128 ký tự.");
export const loginSchema = z.strictObject({ email, password: z.string().min(1, "Vui lòng nhập mật khẩu.").max(128) });
export const signupSchema = z.strictObject({
  display_name: z.string().trim().min(1, "Vui lòng nhập tên của bạn.").max(120),
  email, password: passwordSchema,
});
export const forgotPasswordSchema = z.strictObject({ email });
export const resetPasswordSchema = z.strictObject({
  password: passwordSchema, confirm_password: z.string(),
}).refine(v => v.password === v.confirm_password, { message: "Hai mật khẩu chưa khớp.", path: ["confirm_password"] });

// Chỉ các đích nội bộ đã biết. Không nhận URL, protocol-relative hoặc path chứa backslash.
export function safeNextPath(value: string | null | undefined, fallback = "/settings") {
  if (!value || !/^\/(?:hr|candidate\/applications|settings|inbox)(?:\/[a-zA-Z0-9_-]+)*$/.test(value)) return fallback;
  return value;
}

export function authErrorMessage(code?: string) {
  if (code === "invalid_credentials") return "Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.";
  if (code === "email_not_confirmed") return "Bạn cần xác nhận email trước khi đăng nhập. Hãy kiểm tra hộp thư của bạn.";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit") return "Bạn đã thử nhiều lần. Vui lòng chờ một lúc rồi thử lại.";
  if (code === "weak_password") return "Mật khẩu chưa đủ an toàn. Hãy chọn mật khẩu khác với ít nhất 12 ký tự.";
  if (code === "same_password") return "Mật khẩu mới cần khác mật khẩu hiện tại.";
  return "Chưa thể hoàn tất yêu cầu. Vui lòng thử lại sau.";
}
