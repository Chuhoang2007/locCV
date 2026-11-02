"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Info, LoaderCircle } from "lucide-react";
import { loginSchema, signupSchema, forgotPasswordSchema, resetPasswordSchema, safeNextPath } from "@/domain/auth";
import { clientJSON } from "@/lib/client-api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type AuthKind = "login" | "signup" | "forgot-password" | "reset-password";
const fieldsSchema = z.object({ display_name: z.string().optional(), email: z.string().optional(), password: z.string().optional(), confirm_password: z.string().optional() });
type Fields = z.infer<typeof fieldsSchema>;
const schemaFor = (kind: AuthKind) => ({ login: loginSchema, signup: signupSchema, "forgot-password": forgotPasswordSchema, "reset-password": resetPasswordSchema })[kind];

export function AuthForm({ kind, configured, showSetupLink = false, notice, next }: {
  kind: AuthKind; configured: boolean; showSetupLink?: boolean; notice?: string; next?: string;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Fields>({
    resolver: zodResolver(fieldsSchema.superRefine((value, ctx) => {
      const result = schemaFor(kind).safeParse(value);
      if (!result.success) result.error.issues.forEach(issue => ctx.addIssue({ code: "custom", path: issue.path, message: issue.message }));
    })),
  });
  const submit = handleSubmit(async values => {
    setError("");
    try {
      const result = await clientJSON<{ redirect?: string; message?: string }>(`/api/auth/${kind}`, "POST", values);
      if (result.redirect) {
        router.replace(kind === "login" ? safeNextPath(next, result.redirect) : result.redirect);
        router.refresh();
      } else if (result.message) setMessage(result.message);
    } catch (e) { setError(e instanceof Error ? e.message : "Chưa thể hoàn tất yêu cầu."); }
  });
  const title = { login: "Chào bạn trở lại.", signup: "Bắt đầu từ chính bạn.", "forgot-password": "Lấy lại mật khẩu.", "reset-password": "Đặt mật khẩu mới." }[kind];
  const subtitle = { login: "Đăng nhập để tiếp tục hành trình của bạn.", signup: "Tạo một tài khoản cho cả tuyển dụng và tìm việc.", "forgot-password": "Nhập email của bạn. Chúng tôi sẽ gửi hướng dẫn khôi phục.", "reset-password": "Chọn mật khẩu mới để bảo vệ tài khoản của bạn." }[kind];
  const submitLabel = { login: "Đăng nhập", signup: "Tạo tài khoản", "forgot-password": "Gửi liên kết khôi phục", "reset-password": "Lưu mật khẩu mới" }[kind];

  return <div className="auth-form-content">
    <div className="form-heading"><h1>{title}</h1><p>{subtitle}</p></div>
    {notice && <div className="notice" role="status"><Info size={18} aria-hidden="true" /><p>{notice}</p></div>}
    {!configured && <div className="notice" role="status"><Info size={18} aria-hidden="true" /><div><p>Dịch vụ tài khoản đang được thiết lập. Vui lòng quay lại khi dịch vụ sẵn sàng.</p>{showSetupLink && <Link href="/setup" className="text-link">Thiết lập môi trường <ArrowRight size={14} aria-hidden="true" /></Link>}</div></div>}
    {message ? <div className="success-panel" role="status"><CheckCircle2 size={30} aria-hidden="true" /><h3>Hãy kiểm tra email.</h3><p>{message}</p><Button asChild variant="secondary"><Link href="/login">Về trang đăng nhập</Link></Button></div> : <form onSubmit={submit} noValidate className="auth-form">
      {kind === "signup" && <div className="field"><label htmlFor="display_name">Tên hiển thị</label><Input id="display_name" placeholder="Tên bạn muốn mọi người nhìn thấy" autoComplete="name" maxLength={120} {...register("display_name")} aria-invalid={Boolean(errors.display_name)} aria-describedby={errors.display_name ? "name-error" : undefined} />{errors.display_name && <p className="field-error" id="name-error">{errors.display_name.message}</p>}</div>}
      {kind !== "reset-password" && <div className="field"><label htmlFor="email">Địa chỉ email</label><Input id="email" type="email" placeholder="ban@congty.com" autoComplete="email" maxLength={254} {...register("email")} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />{errors.email && <p className="field-error" id="email-error">{errors.email.message}</p>}</div>}
      {kind !== "forgot-password" && <div className="field">
        <div className="field-label-row"><label htmlFor="password">{kind === "reset-password" ? "Mật khẩu mới" : "Mật khẩu"}</label>{kind === "login" && <Link href="/forgot-password">Quên mật khẩu?</Link>}</div>
        <div className="password-input"><Input id="password" type={visible ? "text" : "password"} placeholder={kind === "login" ? "Nhập mật khẩu của bạn" : "Ít nhất 12 ký tự"} autoComplete={kind === "login" ? "current-password" : "new-password"} maxLength={128} {...register("password")} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : kind !== "login" ? "password-hint" : undefined} /><button type="button" className="password-toggle" onClick={() => setVisible(!visible)} aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={visible}>{visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div>
        {errors.password ? <p className="field-error" id="password-error">{errors.password.message}</p> : kind !== "login" && <p className="field-hint" id="password-hint">Dùng ít nhất 12 ký tự, tránh thông tin dễ đoán.</p>}
      </div>}
      {kind === "reset-password" && <div className="field"><label htmlFor="confirm_password">Nhập lại mật khẩu mới</label><Input id="confirm_password" type={visible ? "text" : "password"} autoComplete="new-password" maxLength={128} {...register("confirm_password")} aria-invalid={Boolean(errors.confirm_password)} aria-describedby={errors.confirm_password ? "confirm-error" : undefined} />{errors.confirm_password && <p className="field-error" id="confirm-error">{errors.confirm_password.message}</p>}</div>}
      {error && <div className="notice notice-error" role="alert"><Info size={18} aria-hidden="true" /><p>{error}</p></div>}
      <Button type="submit" className="auth-submit" disabled={!configured || isSubmitting}>{isSubmitting ? <><LoaderCircle size={18} className="spin" aria-hidden="true" /> Đang xử lý…</> : <>{submitLabel}<ArrowRight size={18} aria-hidden="true" /></>}</Button>
      {kind === "signup" && <p className="form-fineprint">Bạn có thể chuyển giữa chế độ tuyển dụng và ứng viên bất cứ lúc nào sau khi đăng nhập.</p>}
      {kind === "forgot-password" && <Link href="/login" className="back-link">Trở về đăng nhập</Link>}
    </form>}
    {kind === "login" && <div className="auth-assurance"><span className="assurance-line" /><p>Một tài khoản. Hai chế độ.</p><span className="assurance-line" /></div>}
  </div>;
}
