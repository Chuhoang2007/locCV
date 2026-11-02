import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
import { isAccountConfigured } from "@/lib/env";
import { getSessionUser } from "@/server/auth";
export const metadata = { title: "Tạo tài khoản" };
export default async function Signup() {
  if (await getSessionUser()) redirect("/settings");
  return <AuthShell kind="signup"><AuthForm kind="signup" configured={isAccountConfigured()} showSetupLink={process.env.NODE_ENV !== "production"} /></AuthShell>;
}
