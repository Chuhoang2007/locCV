import Link from "next/link";
import { ArrowDown, ArrowUpRight, BriefcaseBusiness, UserRound, ShieldCheck } from "lucide-react";
import { Brand } from "./brand";

export function AuthShell({ children, kind }: { children: React.ReactNode; kind: "login" | "signup" | "recovery" }) {
  return <main className="auth-layout" id="main-content">
    <section className="auth-story" aria-label="Một tài khoản cho hai chế độ">
      <Brand light />
      <div className="story-content">
        <p className="story-title">Bạn tuyển người.<br />Bạn tìm việc.<br /><span>Vẫn là bạn.</span></p>
        <p>Một tài khoản kết nối hai phía của hành trình nghề nghiệp. Chuyển vai trò, tiếp tục cơ hội.</p>
        <div className="identity-map" aria-label="Một tài khoản chung cho nhà tuyển dụng và ứng viên">
          <div className="identity-node"><UserRound size={19} aria-hidden="true" /><span>Tài khoản của bạn</span><span className="identity-dot" /></div>
          <div className="identity-connector"><ArrowDown size={18} aria-hidden="true" /></div>
          <div className="identity-roles">
            <div><BriefcaseBusiness size={22} aria-hidden="true" /><span>Nhà tuyển dụng</span><span className="role-detail">Tìm đúng người</span></div>
            <div><UserRound size={22} aria-hidden="true" /><span>Ứng viên</span><span className="role-detail">Chọn đúng cơ hội</span></div>
          </div>
        </div>
      </div>
      <p className="story-footnote"><ShieldCheck size={17} aria-hidden="true" /> Quyền riêng tư đồng hành cùng bạn.</p>
    </section>
    <section className="auth-workspace" aria-label="Tài khoản">
      <div className="auth-topline">
        <div className="mobile-brand"><Brand /></div>
        <p>{kind === "login" ? <>Chưa có tài khoản? <Link href="/signup">Đăng ký <ArrowUpRight size={15} aria-hidden="true" /></Link></> : <>Đã có tài khoản? <Link href="/login">Đăng nhập <ArrowUpRight size={15} aria-hidden="true" /></Link></>}</p>
      </div>
      <div className="auth-form-area">{children}</div>
      <footer className="auth-footer"><span>LocCV — Kết nối năng lực và cơ hội.</span><span>Tiếng Việt</span></footer>
    </section>
  </main>;
}
