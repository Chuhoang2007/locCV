"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight,Info,LoaderCircle } from "lucide-react";
import type { ApplicationDetail } from "@/domain/applications";
import { useTask } from "@/hooks/use-task";
import { clientJSON } from "@/lib/client-api";
import { Button } from "./ui/button";
export function InterviewResult({initial}:{initial:ApplicationDetail}){
  const router=useRouter(),{task,setTask,error:pollError}=useTask(initial.interview_task);const [busy,setBusy]=useState(false),[error,setError]=useState("");const hr=initial.audience==="HR";
  useEffect(()=>{if(task?.state==="SUCCEEDED"&&initial.interview_score===null)router.refresh();},[task?.state,initial.interview_score,router]);
  async function retry(){if(!task)return;setBusy(true);setError("");try{await clientJSON(`/api/tasks/${task.id}/retry`,"POST",{}, {"Idempotency-Key":crypto.randomUUID()});const next=await clientJSON<ApplicationDetail>(`/api/${hr?"hr/":""}applications/${initial.id}`,"GET");setTask(next.interview_task);router.refresh();}catch(error){setError(error instanceof Error?error.message:"Chưa thử chấm lại được.");}finally{setBusy(false);}}
  if(!initial.interview_started_at)return null;
  return <section className="interview-result-section"><h2>Kết quả bài thi</h2>
    {!initial.interview_submitted_at?<><p>Bài thi đã bắt đầu. Thời hạn được giữ nguyên khi tải lại hoặc đăng nhập lại.</p>{!hr&&<Button asChild><Link href={`/candidate/applications/${initial.id}/interview`}>Tiếp tục bài thi<ArrowRight size={16} aria-hidden="true"/></Link></Button>}</>
      :<><p>{initial.submission_reason==="TIMEOUT"?"Đã tiếp nhận bản lưu khi hết giờ.":"Bài làm đã nộp và được khóa."}</p>
      <dl className="interview-score-list"><div><dt>Trắc nghiệm · 40%</dt><dd>{initial.quiz_score===null?"Chưa có điểm":`${initial.quiz_score}/100`}</dd></div><div><dt>Tự luận · 60%</dt><dd>{initial.essay_score===null?"Đang chờ đánh giá":`${initial.essay_score}/100`}</dd></div><div><dt>Tổng bài thi</dt><dd>{initial.interview_score===null?"Chưa hoàn tất":`${initial.interview_score}/100`}</dd></div></dl>
      {initial.interview_summary&&<p>{initial.interview_summary}</p>}<p className="field-hint">Tổng bài thi = trắc nghiệm × 40% + tự luận × 60%. Điểm CV hiển thị riêng và không cộng vào tổng. {initial.hr_decided_at?"HR đã chốt phản hồi ở phần trên.":"Điểm số hỗ trợ HR xem xét, chưa phải quyết định tuyển dụng."}</p>
      {task&&initial.interview_score===null&&<div className={`task-status ${task.state==="FAILED"?"task-status-error":""}`} aria-live="polite" aria-label="Tiến trình chấm tự luận">{task.state==="FAILED"?<Info size={21} aria-hidden="true"/>:<LoaderCircle className="spin" size={21} aria-hidden="true"/>}<div><h3>{task.state==="FAILED"?"Chưa hoàn tất chấm tự luận":task.state==="QUEUED"?"Bài tự luận đang chờ đánh giá":"Đang đánh giá bài tự luận"}</h3><p>{task.state==="FAILED"?"Điểm trắc nghiệm đã được giữ lại. Chưa có điểm tự luận hoặc tổng điểm; lỗi dịch vụ không được tính thành 0.":"Bạn có thể rời trang và quay lại. Bài làm đã khóa, không cần nộp lại."}</p>{task.state==="FAILED"&&!task.can_retry&&<p>Đã hết lượt thử lại hiện tại. Hãy quay lại sau.</p>}{pollError&&<p className="field-error">{pollError}</p>}</div>{task.can_retry&&<Button variant="secondary" disabled={busy} onClick={retry}>Thử chấm lại tự luận</Button>}</div>}
    </>}
    {error&&<p className="notice notice-error" role="alert">{error}</p>}
    {hr&&initial.interview_review&&<div className="interview-hr-review"><h3>Trắc nghiệm — đáp án và điểm</h3>{initial.interview_review.quiz.map((q,i)=><article className="cv-criterion" key={q.id}><div className="cv-criterion-heading"><h4>Câu {i+1}. {q.prompt}</h4><strong>{q.earned_points}/{q.max_points} điểm</strong></div><p>Đã chọn: {q.selected??"Bỏ trống"}</p><p>Đáp án: {q.expected}</p></article>)}<h3>Tự luận — câu trả lời và bằng chứng</h3>{initial.interview_review.essay.map((q,i)=><article key={q.id} className="cv-criterion"><div className="cv-criterion-heading"><h4>Câu {i+1}. {q.prompt}</h4><strong>{q.earned_points===null?"Chờ chấm":`${q.earned_points}/${q.max_points} điểm`}</strong></div><pre className="cv-submitted-text">{q.answer.trim()?q.answer:"Ứng viên bỏ trống câu này."}</pre>{q.feedback&&<p>{q.feedback}</p>}{q.criteria.map(c=><section key={c.id} className="interview-essay-criterion"><h5>{c.description} · {c.score===null?"Chờ chấm":`${c.score}/${c.max_points} điểm`}</h5><details><summary>Hướng dẫn chấm đã chốt</summary><p>{c.guidance}</p></details>{c.feedback&&<p>{c.feedback}</p>}{c.evidence.map((quote,j)=><blockquote key={j}>{quote}</blockquote>)}</section>)}</article>)}</div>}
  </section>;
}
