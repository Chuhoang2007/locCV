import Link from "@/components/loading-link";
import { ArrowUpRight,FileUser } from "lucide-react";
import { applicationStatusLabel,type ApplicationCard } from "@/domain/applications";
import { Button } from "./ui/button";
export function ApplicationList({items,nextCursor,base,hr=false,timezone="Asia/Bangkok",status}:{items:ApplicationCard[];nextCursor:string|null;base:string;hr?:boolean;timezone?:string;status?:string}){
  const next=new URLSearchParams();if(nextCursor)next.set("cursor",nextCursor);if(status)next.set("status",status);
  return <>{items.length?<div className="application-list">{items.map(app=><article className="application-row" key={app.id}>
    <div><span className={`status-badge ${app.status==="CV_PASSED"?"status-published":""}`}>{applicationStatusLabel[app.status]}</span>
      <h2><Link href={`/${hr?"hr":"candidate"}/applications/${app.id}`}>{hr?app.candidate_name:app.job_title}</Link></h2>
      <p>Nộp ngày {new Intl.DateTimeFormat("vi-VN",{dateStyle:"medium",timeZone:timezone}).format(new Date(app.created_at))}{app.cv_score!==null&&<> · Điểm CV: <strong>{app.cv_score}/100</strong></>}{app.interview_score!==null&&<> · Bài thi: <strong>{app.interview_score}/100</strong></>}</p></div>
    <Link className="text-link" href={`/${hr?"hr":"candidate"}/applications/${app.id}`}>Xem hồ sơ<ArrowUpRight size={16} aria-hidden="true"/></Link>
  </article>)}</div>:<section className="empty-state"><div className="empty-icon"><FileUser size={30} aria-hidden="true"/></div><h2>{hr?"Chưa có hồ sơ phù hợp bộ lọc.":"Chưa có hồ sơ ứng tuyển."}</h2><p>{hr?"Hồ sơ mới sẽ xuất hiện tại đây sau khi ứng viên gửi CV.":"Khám phá việc làm và gửi CV để bắt đầu theo dõi kết quả tại đây."}</p>{!hr&&<Button asChild variant="secondary"><Link href="/jobs">Khám phá việc làm<ArrowUpRight size={16} aria-hidden="true"/></Link></Button>}</section>}
    {nextCursor&&<div className="pagination"><Button asChild variant="secondary"><Link href={`${base}?${next}`}>Xem hồ sơ trước</Link></Button></div>}</>;
}
