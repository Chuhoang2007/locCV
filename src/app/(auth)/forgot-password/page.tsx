import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { isAccountConfigured } from "@/lib/env";
export const metadata = { title: "Khôi phục mật khẩu" };
export default function ForgotPassword() {
  return <AuthShell kind="recovery"><AuthForm kind="forgot-password" configured={isAccountConfigured()} showSetupLink={process.env.NODE_ENV !== "production"} /></AuthShell>;
}
