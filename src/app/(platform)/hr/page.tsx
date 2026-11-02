import { ApplicationSummary } from "@/components/application-summary";
import { BriefcaseBusiness, Plus, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { requireViewer } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { listHRJobs } from "@/server/dal/jobs";
import { JobStatus } from "@/components/job-status";
export const metadata = { title: "Không gian tuyển dụng" };
export default async function HRHome({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const viewer=await requireViewer();const params=await searchParams;
  const result=await listHRJobs(viewer.id,params);
  const next=new URLSearchParams(Object.entries(params).filter((entry):entry is [string,string]=>typeof entry[1]==="string"));if(result.next_cursor)next.set("cursor",result.next_cursor);
  return <div><header className="page-heading heading-with-action"><div><h1>Không gian tuyển dụng</h1><p>Soạn nháp, duyệt nội dung và tìm người đồng hành.</p></div><Button asChild><Link href="/hr/jobs/new"><Plus size={17} aria-hidden="true" />Tạo tin tuyển dụng</Link></Button></header>
    <ApplicationSummary actor={viewer.id}/><nav className="job-filters" aria-label="Lọc trạng thái tin">{[["","Tất cả"],["DRAFT","Bản nháp"],["PUBLISHED","Đang tuyển"],["CLOSED","Đã đóng"]].map(([status,label])=><Link key={status} href={status?`/hr?status=${status}`:"/hr"} aria-current={(params.status??"")===status?"page":undefined}>{label}</Link>)}</nav>
    {result.items.length?<div className="hr-job-list">{result.items.map(job=><article className="hr-job-row" key={job.id}><div><JobStatus status={job.status}/><h2><Link href={`/hr/jobs/${job.id}`}>{job.title||"Tin tuyển dụng chưa đặt tên"}</Link></h2><p>Cập nhật {new Intl.DateTimeFormat("vi-VN",{dateStyle:"medium",timeZone:viewer.profile.timezone}).format(new Date(job.updated_at))}</p></div><Link href={`/hr/jobs/${job.id}${job.status==="DRAFT"?"/edit":""}`} className="text-link">{job.status==="DRAFT"?"Tiếp tục soạn":"Xem chi tiết"}<ArrowUpRight size={16} aria-hidden="true"/></Link></article>)}</div>:<section className="empty-state"><div className="empty-icon"><BriefcaseBusiness size={32} strokeWidth={1.5} aria-hidden="true" /></div><h2>{params.status?"Chưa có tin ở trạng thái này.":"Bắt đầu với vị trí bạn cần tuyển."}</h2><p>Nhập nhu cầu tuyển dụng để AI tạo JD, tiêu chí CV và bài thi. Bạn có thể chỉnh từng phần trước khi đăng.</p><Button asChild variant="secondary"><Link href="/hr/jobs/new">Tạo bản nháp đầu tiên<ArrowUpRight size={16} aria-hidden="true" /></Link></Button></section>}
    {result.next_cursor&&<div className="pagination"><Button asChild variant="secondary"><Link href={`/hr?${next}`}>Xem các tin trước</Link></Button></div>}
  </div>;
}
