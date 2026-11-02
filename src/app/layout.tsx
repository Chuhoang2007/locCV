import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/vietnamese-400.css";
import "@fontsource/be-vietnam-pro/vietnamese-500.css";
import "@fontsource/be-vietnam-pro/vietnamese-600.css";
import "@fontsource/be-vietnam-pro/vietnamese-700.css";
import "@fontsource/be-vietnam-pro/latin-400.css";
import "@fontsource/be-vietnam-pro/latin-500.css";
import "@fontsource/be-vietnam-pro/latin-600.css";
import "@fontsource/be-vietnam-pro/latin-700.css";
import "./globals.css";

export const metadata: Metadata = { title: { default: "LocCV — Kết nối năng lực và cơ hội", template: "%s | LocCV" }, description: "Một tài khoản cho hành trình tuyển dụng và tìm việc của bạn." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body><a href="#main-content" className="skip-link">Đến nội dung chính</a>{children}</body></html>;
}
