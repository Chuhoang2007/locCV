import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { isAccountConfigured } from "@/lib/env";
import { getSessionUser } from "@/server/auth";
export const metadata = { title: "Mật khẩu mới" };
export default async function ResetPassword() {
  if (!await getSessionUser()) redirect("/forgot-password");
  return <AuthShell kind="recovery"><AuthForm kind="reset-password" configured={isAccountConfigured()} /></AuthShell>;
}
