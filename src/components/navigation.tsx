"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, FileUser, Settings2, ArrowUpRight,Search,Mail } from "lucide-react";
import type { ViewerDTO } from "@/domain/dto";
import { InboxBadge } from "./inbox-badge";
import { BufferCleanup } from "./buffer-cleanup";
import { Brand } from "./brand";
import { ModeSwitch } from "./mode-switch";
import { SignoutButton } from "./signout-button";

export function Navigation({ viewer }: { viewer: ViewerDTO }) {
  const pathname = usePathname();
  const home = viewer.profile.preferred_mode === "HR" ? "/hr" : "/candidate/applications";
  const isHR = viewer.profile.preferred_mode === "HR";
  return <><BufferCleanup/><aside className="sidebar">
    <Brand />
    <nav aria-label="Điều hướng chính"><Link href={home} className={pathname === home || (isHR&&pathname.startsWith("/hr/jobs/")) ? "nav-link active" : "nav-link"} aria-current={pathname === home ? "page" : undefined}>{isHR ? <BriefcaseBusiness size={19} aria-hidden="true" /> : <FileUser size={19} aria-hidden="true" />}{isHR ? "Không gian tuyển dụng" : "Hồ sơ ứng tuyển"}</Link><Link href="/jobs" className="nav-link"><Search size={19} aria-hidden="true"/>Khám phá việc làm</Link><Link href="/inbox" className={pathname.startsWith("/inbox")?"nav-link active":"nav-link"} aria-current={pathname.startsWith("/inbox")?"page":undefined}><Mail size={19} aria-hidden="true"/><span>Hộp thư</span><InboxBadge/></Link><Link href="/settings" className={pathname === "/settings" ? "nav-link active" : "nav-link"} aria-current={pathname === "/settings" ? "page" : undefined}><Settings2 size={19} aria-hidden="true" />Cài đặt tài khoản</Link></nav>
    <div className="sidebar-note"><span className="small-sprout"><ArrowUpRight size={23} aria-hidden="true" /></span><p>Mỗi lần chuyển vai,<br />một góc nhìn mới.</p><span>Tài khoản vẫn là của bạn.</span></div>
    <div className="sidebar-profile"><div className="avatar" aria-hidden="true">{viewer.profile.display_name.slice(0,1).toLocaleUpperCase("vi")}</div><div className="sidebar-profile-name"><strong>{viewer.profile.display_name}</strong><span>Tài khoản cá nhân</span></div></div>
  </aside><header className="platform-topbar"><div className="mobile-brand"><Brand /></div><span className="topbar-label">Không gian cá nhân</span><ModeSwitch mode={viewer.profile.preferred_mode} /><SignoutButton /></header></>;
}
