import Link from "@/components/loading-link";
import { ArrowUpRight, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { requireViewer } from "@/server/auth";
import { deletionStatus } from "@/server/dal/messages";
import { DeletionRequest } from "@/components/deletion-request";
import { ProfileForm } from "@/components/profile-form";
export const metadata = { title: "Cài đặt tài khoản" };
export default async function Settings({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const deletion = await deletionStatus(viewer.id);
  return <div className="settings-page"><header className="page-heading"><h1>Cài đặt tài khoản</h1><p>Thông tin của bạn, nhất quán ở mọi vai trò.</p></header>
    {params.password_changed && params.signout_pending && <div className="notice" role="status"><ShieldCheck size={18} aria-hidden="true" /><p>Mật khẩu đã đổi, nhưng chưa đăng xuất được các phiên hiện tại. Hãy dùng nút Đăng xuất ở thanh trên để đăng nhập lại.</p></div>}
    <section className="profile-summary" aria-label="Hồ sơ tài khoản"><div className="avatar avatar-large" aria-hidden="true">{viewer.profile.display_name.slice(0,1).toLocaleUpperCase("vi")}</div><div><h2>{viewer.profile.display_name}</h2><p>{viewer.email}</p></div><span className="account-badge"><UserRound size={14} aria-hidden="true" />Tài khoản cá nhân</span></section>
    <section className="settings-section"><div className="section-description"><h2>Thông tin cá nhân</h2><p>Cập nhật cách bạn xuất hiện và thời gian hiển thị trong tài khoản.</p></div><ProfileForm profile={viewer.profile} /></section>
    <section className="settings-section"><div className="section-description"><h2>Đăng nhập & bảo mật</h2><p>Email dùng chung cho cả chế độ tuyển dụng và ứng viên.</p></div><div className="account-security"><div className="security-row"><div className="security-label"><ShieldCheck size={19} aria-hidden="true" /><div><strong>Địa chỉ email</strong><p>{viewer.email}</p></div></div><span className="verified-label">Đã xác thực</span></div><div className="security-row"><div className="security-label"><LockKeyhole size={19} aria-hidden="true" /><div><strong>Mật khẩu</strong><p>Gửi liên kết qua email để đặt mật khẩu mới.</p></div></div><Link className="text-link" href="/forgot-password">Đổi mật khẩu<ArrowUpRight size={16} aria-hidden="true" /></Link></div></div></section>
    <DeletionRequest initial={deletion} timeZone={viewer.profile.timezone} retentionEnabled={process.env.DATA_RETENTION_ENABLED==="true"}/>
    <div className="account-note"><ShieldCheck size={18} aria-hidden="true" /><p>Chuyển chế độ ở thanh trên để thay đổi không gian làm việc. Thông tin tài khoản của bạn vẫn được giữ nguyên.</p></div>
  </div>;
}
