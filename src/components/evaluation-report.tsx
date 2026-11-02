"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft,ArrowRight,CheckCircle2,Clock3,Download,Info,LoaderCircle } from "lucide-react";
import { applicationStatusLabel,type ApplicationDetail } from "@/domain/applications";
import { isTaskActive } from "@/domain/task";
import { useTask } from "@/hooks/use-task";
import { clientJSON } from "@/lib/client-api";
import { Button } from "./ui/button";
import { HRDecision } from "./hr-decision";
import { InterviewResult } from "./interview-result";
export function EvaluationReport({initial,timeZone}:{initial:ApplicationDetail;timeZone:string}){
  const router=useRouter();const {task,setTask,error:pollError}=useTask(initial.task);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const hr=initial.audience==="HR";
  useEffect(()=>{if(task?.state==="SUCCEEDED"&&initial.cv_score===null)router.refresh();},[task?.state,initial.cv_score,router]);
  async function retry(){
    if(!task)return;setBusy(true);setError("");
    try{await clientJSON(`/api/tasks/${task.id}/retry`,"POST",{}, {"Idempotency-Key":crypto.randomUUID()});const next=await clientJSON<ApplicationDetail>(`/api/${hr?"hr/":""}applications/${initial.id}`,"GET");setTask(next.task);router.refresh();}
    catch(error){setError(error instanceof Error?error.message:"Chưa thể thử lại.");}finally{setBusy(false);}
  }
  async function download(){
    setBusy(true);setError("");
    try{const result=await clientJSON<{url:string}>("/api/cv/download-link","POST",{application_id:initial.id});window.location.assign(result.url);}
    catch(error){setError(error instanceof Error?error.message:"Chưa tải được file.");}finally{setBusy(false);}
  }
  return <div className="application-detail"><Link href={hr?`/hr/jobs/${initial.job_id}`:"/candidate/applications"} className="text-link editor-back"><ArrowLeft size={16} aria-hidden="true"/>{hr?"Về tin tuyển dụng":"Hồ sơ ứng tuyển"}</Link>
    <header className="page-heading"><span className={`status-badge ${initial.status==="CV_PASSED"?"status-published":""}`}>{initial.interview_submitted_at&&initial.interview_score===null?"Đang chấm bài":applicationStatusLabel[initial.status]}</span><h1>{hr?initial.candidate_name:initial.job_title}</h1><p>{hr?initial.job_title:"Theo dõi kết quả CV và bước tiếp theo của bạn."}</p></header>
    {task&&initial.cv_score===null&&<section className={`task-status ${task.state==="FAILED"?"task-status-error":""}`} aria-live="polite" aria-label="Tiến trình đánh giá CV">
      {task.state==="FAILED"?<Info size={22} aria-hidden="true"/>:task.state==="QUEUED"?<Clock3 size={22} aria-hidden="true"/>:<LoaderCircle size={22} className="spin" aria-hidden="true"/>}
      <div><h2>{task.state==="FAILED"?"Chưa thể hoàn tất đánh giá CV":task.state==="RETRY_WAIT"?"Đang kết nối lại dịch vụ AI":task.state==="QUEUED"?"CV đang chờ đánh giá":"AI đang đánh giá CV"}</h2>
        <p>{task.state==="FAILED"?"Chưa có điểm. Lỗi dịch vụ không có nghĩa là CV bị đánh trượt.":"Bạn có thể rời trang và quay lại. Dịch vụ AI có thể cần thời gian khởi động."}</p>
        {isTaskActive(task.state)&&task.attempt>0&&<p className="task-attempt">Lần kết nối {task.attempt}/3</p>}
        {task.state==="FAILED"&&!task.can_retry&&<p>Đã dùng hai lượt thử lại trong 24 giờ hoặc tác vụ này không còn có thể thử lại. Hãy quay lại sau.</p>}
        {pollError&&<p className="field-error">{pollError}</p>}
      </div>{task.can_retry&&<Button type="button" variant="secondary" disabled={busy} onClick={retry}>Thử chấm lại CV</Button>}
    </section>}
    {error&&<p className="notice notice-error" role="alert">{error}</p>}
    <HRDecision application={initial} timeZone={timeZone}/>
    <InterviewResult initial={initial}/>
    {initial.cv_score!==null&&<section className="cv-result-section" aria-labelledby="cv-result-heading"><div className="cv-result-heading"><h2 id="cv-result-heading">Kết quả đánh giá CV</h2><p className="cv-score">{initial.cv_score}<span>/100 điểm</span></p></div>
      <p className="cv-summary">{initial.summary}</p><p className="field-hint">Ngưỡng CV: {initial.pass_threshold}/100. Điểm CV dùng để xét điều kiện làm bài, không cộng vào điểm bài thi. AI hỗ trợ đánh giá; HR đưa ra quyết định cuối cùng.</p>
    </section>}
    {!initial.hr_decided_at&&!initial.interview_submitted_at&&<section className="cv-next-step"><h2>{initial.eligibility.eligible?<><CheckCircle2 size={20} aria-hidden="true"/>Đủ điều kiện làm bài</>:initial.eligibility.reason==="CV_THRESHOLD"?"Chưa đủ điều kiện làm bài":"Bước tiếp theo"}</h2>
      <p>{initial.eligibility.eligible?initial.interview_access_policy==="ALWAYS"&&initial.status==="CV_FAILED"?"Vị trí này cho phép làm bài sau khi CV được chấm, kể cả khi chưa đạt ngưỡng CV.":"CV đã đạt ngưỡng của vị trí này.":initial.eligibility.reason==="CV_THRESHOLD"?`Vị trí yêu cầu điểm CV từ ${initial.pass_threshold}. Hồ sơ đã được chuyển đến HR để xem xét.`:"Bài thi được xét điều kiện sau khi CV được chấm thành công."}</p>
      {initial.eligibility.eligible&&!hr&&!initial.interview_started_at&&<Button asChild><Link href={`/candidate/applications/${initial.id}/interview`}>Xem hướng dẫn & bắt đầu<ArrowRight size={16} aria-hidden="true"/></Link></Button>}
    </section>}
    {hr&&initial.report&&<section className="cv-evidence-section"><h2>Chi tiết từng tiêu chí</h2>{initial.report.criteria.map(c=><article key={c.criterion_id} className="cv-criterion"><div className="cv-criterion-heading"><h3>{initial.criterion_labels?.[c.criterion_id]??c.criterion_id}</h3><strong>{c.score}/{c.max_points} điểm</strong></div><p>{c.feedback}</p>
      {c.evidence.length>0&&<><h4>Bằng chứng trong CV</h4>{c.evidence.map((quote,i)=><blockquote key={i}>{quote}</blockquote>)}</>}
      {c.missing_evidence.length>0&&<><h4>Cần xác minh thêm</h4><ul>{c.missing_evidence.map((note,i)=><li key={i}>{note}</li>)}</ul></>}
    </article>)}</section>}
    <section className="cv-submitted-section"><div className="cv-criterion-heading"><h2>Nội dung CV đã gửi</h2>{initial.has_file&&<Button variant="secondary" size="small" disabled={busy} onClick={download}><Download size={16} aria-hidden="true"/>Tải file CV</Button>}</div><p className="field-hint">Nguồn: {initial.cv_source==="TEXT"?"Văn bản":initial.cv_source}. Nội dung được giữ nguyên từ lúc tiếp nhận.</p><details className="assessment-details"><summary>Xem văn bản CV</summary><pre className="cv-submitted-text">{initial.cv_text}</pre></details></section>
  </div>;
}
