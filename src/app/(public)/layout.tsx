import Link from "@/components/loading-link";
import { Brand } from "@/components/brand";
import { getSessionUser } from "@/server/auth";
export const dynamic="force-dynamic";
export default async function PublicLayout({children}:{children:React.ReactNode}){
  const user=await getSessionUser().catch(()=>null);
  return <div className="public-layout"><header className="public-header"><Brand/><nav aria-label="Điều hướng việc làm"><Link href="/jobs">Khám phá việc làm</Link>{user?<Link href="/hr">Không gian của tôi</Link>:<><Link href="/login">Đăng nhập</Link><Link href="/signup" className="public-signup">Tạo tài khoản</Link></>}</nav></header><main id="main-content" className="public-main">{children}</main><footer className="public-footer">LocCV — Kết nối năng lực và cơ hội.</footer></div>;
}
