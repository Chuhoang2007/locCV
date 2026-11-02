import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { isAccountConfigured } from "@/lib/env";
import { getSessionUser } from "@/server/auth";
import { safeNextPath } from "@/domain/auth";
export const metadata = { title: "Đăng nhập" };
export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  if (await getSessionUser()) redirect(next ?? "/settings");
  const notice = params.updated ? "Mật khẩu đã được cập nhật. Bạn có thể đăng nhập bằng mật khẩu mới." : params.link_error ? "Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới hoặc đăng nhập lại." : undefined;
  return <AuthShell kind="login"><AuthForm kind="login" configured={isAccountConfigured()} showSetupLink={process.env.NODE_ENV !== "production"} notice={notice} next={next} /></AuthShell>;
}
