import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Circle } from "lucide-react";
import { hasPublicEnv, isAccountConfigured } from "@/lib/env";
import { Brand } from "@/components/brand";
export default function Setup() {
  if (process.env.NODE_ENV === "production") notFound();
  const publicReady = hasPublicEnv();
  const accountReady = isAccountConfigured();
  return <main id="main-content" className="setup-page"><Brand /><h1>Kết nối môi trường phát triển.</h1><p>Ứng dụng đã sẵn sàng chạy local. Cấu hình Supabase để bật đăng ký, đăng nhập và lưu hồ sơ thật.</p><ol className="setup-steps"><li><h2>Tạo file cấu hình</h2><p>Sao chép <code>.env.example</code> thành <code>.env.local</code>. Điền URL, publishable key và secret key của project Supabase test.</p></li><li><h2>Tạo cấu trúc dữ liệu</h2><p>Chạy ba migration trong <code>supabase/migrations/</code> theo thứ tự. Hướng dẫn CLI và SQL Editor có trong <code>README.md</code>.</p></li><li><h2>Cấu hình email và khởi động lại</h2><p>Đặt Site URL và redirect URLs theo README, cấu hình mẫu thư xác nhận/khôi phục, sau đó chạy lại <code>npm run dev</code>.</p></li></ol><div className="setup-status"><p>{publicReady ? <Check size={18} /> : <Circle size={18} />} Cấu hình Auth công khai: {publicReady ? "đã có" : "chưa có"}</p><p>{accountReady ? <Check size={18} /> : <Circle size={18} />} Cấu hình tài khoản server: {accountReady ? "đã có" : "chưa có"}</p><small>Trạng thái chỉ kiểm tra sự hiện diện cấu hình, chưa xác minh kết nối hoặc migration.</small></div><Link className="text-link" href="/login"><ArrowLeft size={17} /> Về đăng nhập</Link></main>;
}
