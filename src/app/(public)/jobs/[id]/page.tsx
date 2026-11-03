import Link from "@/components/loading-link";
import { notFound } from "next/navigation";
import { ArrowLeft,Clock3,MapPin,ShieldCheck } from "lucide-react";
import { AppError } from "@/lib/errors";
import { getPublicJob } from "@/server/dal/jobs";
import { JobDescription,salaryLabel } from "@/components/job-description";
import { Button } from "@/components/ui/button";
export const metadata={title:"Chi tiết việc làm"};
export default async function JobDetail({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const job=await getPublicJob(id).catch(error=>{if(error instanceof AppError&&error.status===400)notFound();throw error;});if(!job)notFound();
  return <div className="public-detail"><Link href="/jobs" className="text-link editor-back"><ArrowLeft size={16} aria-hidden="true"/>Khám phá việc làm</Link><header className="public-detail-heading"><span className="status-badge status-published">Đang tuyển</span><h1>{job.title}</h1><div className="detail-facts"><span><MapPin size={16} aria-hidden="true"/>{job.location}</span><strong>{salaryLabel(job.salary_min,job.salary_max)}</strong></div><div className="skill-tags">{job.skills.map(skill=><span key={skill}>{skill}</span>)}</div></header><div className="public-detail-grid"><JobDescription jd={job.jd}/><aside className="application-guide"><h2>Quy trình ứng tuyển</h2><ol><li>Nộp CV và xem kết quả đánh giá.</li><li>{job.interview_access_policy==="ALWAYS"?"Làm bài sau khi CV được chấm.":`Làm bài khi CV đạt từ ${job.pass_threshold} điểm.`}</li><li>Nhận phản hồi từ nhà tuyển dụng.</li></ol><p><Clock3 size={17} aria-hidden="true"/>{job.duration_minutes} phút làm bài</p><Button asChild><Link href={`/jobs/${id}/apply`}>Ứng tuyển ngay</Link></Button><p className="field-hint"><ShieldCheck size={16} aria-hidden="true"/>Đề thi chỉ mở khi bạn đủ điều kiện và bắt đầu làm bài.</p></aside></div></div>;
}
