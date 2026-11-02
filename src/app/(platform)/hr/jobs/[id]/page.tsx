import { ApplicationSummary } from "@/components/application-summary";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft,ArrowUpRight,Clock3,MapPin } from "lucide-react";
import { getOwnedJob } from "@/server/dal/jobs";
import { requireViewer } from "@/server/auth";
import { AppError } from "@/lib/errors";
import { JobStatus } from "@/components/job-status";
import { JobDescription,salaryLabel } from "@/components/job-description";
import { CloseJobButton } from "@/components/close-job-button";
import { Button } from "@/components/ui/button";
import { listApplications } from "@/server/dal/applications";
import { applicationStatusLabel } from "@/domain/applications";
import { ApplicationList } from "@/components/application-list";
export const metadata={title:"Chi tiết tin tuyển dụng"};
export default async function HRJob({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const viewer=await requireViewer();const {id}=await params;const {job}=await getOwnedJob(id,viewer.id).catch(error=>{if(error instanceof AppError&&[400,404].includes(error.status))notFound();throw error;});
  const filters=await searchParams;const applications=await listApplications(viewer.id,filters,id);
  return <div><Link href="/hr" className="text-link editor-back"><ArrowLeft size={16} aria-hidden="true"/>Tin tuyển dụng của tôi</Link><header className="page-heading heading-with-action"><div><JobStatus status={job.status}/><h1 className="detail-title">{job.jd_json?.title||"Tin tuyển dụng chưa đặt tên"}</h1><p>{job.status==="DRAFT"?"Chỉ bạn nhìn thấy bản nháp này.":job.status==="PUBLISHED"?"Tin đang hiển thị công khai. Cấu hình đánh giá đã được cố định.":"Tin đã đóng, không nhận hồ sơ mới."}</p></div><div className="editor-actions">{job.status==="DRAFT"?<Button asChild><Link href={`/hr/jobs/${id}/edit`}>Chỉnh sửa & duyệt</Link></Button>:job.status==="PUBLISHED"?<><Button asChild variant="secondary"><Link href={`/jobs/${id}`}>Xem tin công khai<ArrowUpRight size={15} aria-hidden="true"/></Link></Button><CloseJobButton id={id} version={job.version}/></>:null}</div></header>
    <ApplicationSummary actor={viewer.id} job={id}/>{job.status!=="DRAFT"&&<section className="job-applications"><h2>Hồ sơ ứng tuyển</h2><form className="application-filter" method="get"><label htmlFor="application-status">Trạng thái hồ sơ</label><select className="input" name="status" id="application-status" defaultValue={filters.status??""}><option value="">Tất cả trạng thái</option>{Object.entries(applicationStatusLabel).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><Button type="submit" variant="secondary">Lọc hồ sơ</Button></form><ApplicationList items={applications.items} nextCursor={applications.next_cursor} base={`/hr/jobs/${id}`} hr timezone={viewer.profile.timezone} status={filters.status}/></section>}
    {job.jd_json?<><div className="detail-facts"><span><MapPin size={16} aria-hidden="true"/>{job.jd_json.location||"Chưa nhập địa điểm"}</span><span>{salaryLabel(job.jd_json.salary_min,job.jd_json.salary_max)}</span><span><Clock3 size={16} aria-hidden="true"/>{job.interview_questions_json?.duration_minutes??30} phút làm bài</span></div><JobDescription jd={job.jd_json}/></>:<div className="notice">Bản nháp chưa có nội dung JD. Mở phần chỉnh sửa để soạn hoặc theo dõi tiến trình AI.</div>}
    {job.scoring_rubric_json&&<details className="assessment-details"><summary>Tiêu chí lọc CV — dành riêng HR</summary><p>Ngưỡng qua vòng: {job.scoring_rubric_json.pass_threshold}/100 điểm.</p><ul>{job.scoring_rubric_json.criteria.map(c=><li key={c.id}><strong>{c.label}: {c.max_points} điểm</strong><p>{c.scoring_guidance}</p></li>)}</ul></details>}
    {job.interview_questions_json&&<details className="assessment-details"><summary>Đề thi & đáp án — dành riêng HR</summary><h2>Trắc nghiệm</h2>{job.interview_questions_json.quiz.map((q,i)=><section key={q.id}><h3>{i+1}. {q.prompt}</h3><ul>{q.options.map(o=><li key={o.id}>{o.text}{o.id===q.correct_answer&&<strong className="correct-answer"> — Đáp án đúng</strong>}</li>)}</ul></section>)}<h2>Tự luận</h2>{job.interview_questions_json.essay.map((q,i)=><section key={q.id}><h3>{i+1}. {q.prompt}</h3><ul>{q.rubric.map(c=><li key={c.id}>{c.description} ({c.max_points} điểm): {c.scoring_guidance}</li>)}</ul></section>)}</details>}
  </div>;
}
