import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireViewer } from "@/server/auth";
import { getPublicJob } from "@/server/dal/jobs";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbResult } from "@/server/rpc";
import { AppError } from "@/lib/errors";
import { CVInput } from "@/components/cv-input";
export const metadata={title:"Gửi hồ sơ ứng tuyển"};
export default async function Apply({params}:{params:Promise<{id:string}>}){
  const viewer=await requireViewer();const {id}=await params;
  const job=await getPublicJob(id).catch(error=>{if(error instanceof AppError&&[400,404].includes(error.status))notFound();throw error;});if(!job)notFound();
  const owner=await dbResult(createAdminClient().from("jobs").select("owner_user_id").eq("id",id).single());
  const existing=await dbResult(createAdminClient().from("applications").select("id").eq("job_id",id).eq("candidate_user_id",viewer.id).maybeSingle());
  return <div className="cv-apply-page"><Link className="text-link editor-back" href={`/jobs/${id}`}><ArrowLeft size={16} aria-hidden="true"/>Về tin tuyển dụng</Link><header className="page-heading"><h1>Gửi hồ sơ ứng tuyển</h1><p>{job.title}</p></header>
    {owner.owner_user_id===viewer.id?<div className="notice">Bạn là người đăng tin này. Không thể tự ứng tuyển khi chuyển chế độ. <Link className="text-link" href={`/hr/jobs/${id}`}>Quản lý tin tuyển dụng</Link></div>:existing?<div className="notice">Bạn đã nộp hồ sơ cho vị trí này. <Link className="text-link" href={`/candidate/applications/${existing.id}`}>Xem hồ sơ đã nộp</Link></div>:<CVInput jobId={id}/>}
  </div>;
}
