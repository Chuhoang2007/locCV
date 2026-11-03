"use client";
import Link from "@/components/loading-link";
import { useCallback,useEffect,useRef,useState } from "react";
import { ArrowLeft,ArrowRight,Check,CheckCircle2,Clock3,LoaderCircle,Save } from "lucide-react";
import { interviewDTOSchema,type InterviewDTO } from "@/domain/interview";
import { remainingMilliseconds,timerLabel } from "@/domain/interview-timer";
import { clientJSON } from "@/lib/client-api";
import { useAnswerAutosave } from "@/hooks/use-answer-autosave";
import { Button } from "./ui/button";
export function InterviewRunner({initial,userId,timezone}:{initial:InterviewDTO;userId:string;timezone:string}){
  const [paper,setPaper]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function refresh(){const next=interviewDTOSchema.parse(await clientJSON(`/api/applications/${paper.id}/interview`,"GET"));setPaper(next);}
  async function start(){setBusy(true);setError("");try{setPaper(interviewDTOSchema.parse(await clientJSON(`/api/applications/${paper.id}/interview/start`,"POST",{})));}catch(error){setError(error instanceof Error?error.message:"Chưa bắt đầu được bài thi.");}finally{setBusy(false);}}
  if(paper.state==="IN_PROGRESS")return <ActiveInterview initial={paper} userId={userId} timezone={timezone} onSubmitted={refresh}/>;
  const submitted=paper.state==="SUBMITTED"||paper.state==="EVALUATED";
  return <div className="interview-page"><Link className="text-link editor-back" href={`/candidate/applications/${paper.id}`}><ArrowLeft size={16} aria-hidden="true"/>Về hồ sơ ứng tuyển</Link>
    <header className="page-heading"><h1>{submitted?"Bài làm đã được khóa":"Trước khi bắt đầu bài thi"}</h1><p>{paper.job_title}</p></header>
    {submitted?<section className="interview-intro"><CheckCircle2 size={30} aria-hidden="true"/><h2>{paper.submission_reason==="TIMEOUT"?"Đã tiếp nhận bản lưu khi hết giờ":"Đã tiếp nhận bài làm"}</h2><p>{paper.state==="EVALUATED"?"Kết quả bài thi đã sẵn sàng trong hồ sơ ứng tuyển.":"Trắc nghiệm được chấm trên server; phần tự luận đang được đánh giá. Bạn có thể rời trang và quay lại."}</p><p>Câu trả lời không thể thay đổi sau khi nộp.</p><Button asChild><Link href={`/candidate/applications/${paper.id}`}>Theo dõi kết quả<ArrowRight size={16} aria-hidden="true"/></Link></Button></section>
      :<section className="interview-intro"><h2>{paper.duration_minutes} phút · một lượt làm bài</h2><p>Bài thi gồm trắc nghiệm (40%) và tự luận (60%). Điểm CV không cộng vào điểm bài thi.</p><ul><li>Thời gian bắt đầu ngay khi bạn chọn Bắt đầu bài thi.</li><li>Tải lại, đổi chế độ hay đăng nhập lại không khởi động đồng hồ mới.</li><li>Câu trả lời tự động lưu khi có mạng. Chỉ bản server nhận trước thời hạn được chấm.</li><li>Khi hết giờ, hệ thống khóa và tiếp nhận phần đã lưu, kể cả khi bạn đóng tab.</li></ul>{paper.eligible?<Button type="button" disabled={busy} onClick={start}>{busy?<LoaderCircle className="spin" size={17} aria-hidden="true"/>:<Clock3 size={17} aria-hidden="true"/>}Bắt đầu bài thi</Button>:<p className="notice">Hồ sơ chưa đủ điều kiện bắt đầu. Hãy quay lại xem kết quả đánh giá CV.</p>}</section>}
    {error&&<p className="notice notice-error" role="alert">{error}</p>}
  </div>;
}
function ActiveInterview({initial,userId,timezone,onSubmitted}:{initial:InterviewDTO;userId:string;timezone:string;onSubmitted:()=>Promise<void>}){
  const checkClosed=useCallback(()=>{void clientJSON<InterviewDTO>(`/api/applications/${initial.id}/interview`,"GET").then(next=>{if(next.state!=="IN_PROGRESS")void onSubmitted();}).catch(()=>undefined);},[initial.id,onSubmitted]);
  const save=useAnswerAutosave(initial,userId,checkClosed);const [active,setActive]=useState(0),[confirm,setConfirm]=useState(false),[submitting,setSubmitting]=useState(false),[error,setError]=useState("");
  const [tick,setTick]=useState(()=>performance.now());const sending=useRef(false),lastTimeoutAttempt=useRef(-Infinity);const questionHeading=useRef<HTMLHeadingElement>(null),confirmHeading=useRef<HTMLHeadingElement>(null);
  const seconds=Math.ceil(remainingMilliseconds(save.clock,tick)/1000);const paper=initial.questions!;
  const questions=[...paper.quiz.map(q=>({...q,kind:"QUIZ" as const})),...paper.essay.map(q=>({...q,kind:"ESSAY" as const}))];const question=questions[active];
  const hasAnswer=(id:string,kind:"QUIZ"|"ESSAY")=>kind==="QUIZ"?!!save.answers.quiz.find(a=>a.question_id===id)?.selected_answer:!!save.answers.essay.find(a=>a.question_id===id)?.text.trim();
  const unanswered=questions.filter(q=>!hasAnswer(q.id,q.kind)).length;
  const disabled=seconds===0||submitting||save.status==="CONFLICT"||!!save.recovery||save.status==="CLOSED";
  useEffect(()=>{const timer=setInterval(()=>setTick(performance.now()),250);return()=>clearInterval(timer);},[]);
  useEffect(()=>{questionHeading.current?.focus();},[active]);
  useEffect(()=>{if(confirm)confirmHeading.current?.focus();},[confirm]);
  async function submit(timeout=false){
    if(sending.current)return;
    if(timeout){if(performance.now()-lastTimeoutAttempt.current<5000)return;lastTimeoutAttempt.current=performance.now();}
    sending.current=true;setSubmitting(true);setError("");
    try{
      if(!timeout&&!await save.flush()){setError("Chưa đồng bộ được toàn bộ thay đổi. Hãy xử lý trạng thái lưu trước khi nộp; đồng hồ vẫn tiếp tục chạy.");return;}
      if(timeout)save.lock();
      await clientJSON(`/api/applications/${initial.id}/interview/submit`,"POST",{answer_version:save.getVersion()},{},AbortSignal.timeout(15000));
      save.complete();await onSubmitted();
    }catch(error){setError(error instanceof Error?error.message:"Chưa xác nhận được việc nộp bài. Hệ thống sẽ tiếp tục kiểm tra.");}
    finally{sending.current=false;setSubmitting(false);}
  }
  const submitRef=useRef(submit);
  useEffect(()=>{submitRef.current=submit;});
  useEffect(()=>{if(seconds>0)return;const attempt=()=>{void submitRef.current(true);};attempt();const timer=setInterval(attempt,5000);return()=>clearInterval(timer);},[seconds]);
  return <div className="interview-page"><Link className="text-link editor-back" href={`/candidate/applications/${initial.id}`}><ArrowLeft size={16} aria-hidden="true"/>Về hồ sơ ứng tuyển</Link><header className="page-heading"><h1>Bài thi tuyển dụng</h1><p>{initial.job_title}</p></header>
    <div className="interview-toolbar"><div className={`interview-clock ${seconds<=300?"interview-clock-urgent":""}`}><Clock3 size={20} aria-hidden="true"/><div><span>Thời gian còn lại</span><strong role="timer" aria-live="off" aria-label={`${Math.floor(seconds/60)} phút ${seconds%60} giây`}>{timerLabel(seconds)}</strong></div></div>
      <div className="interview-save-state" role="status" aria-live="polite"><strong>{({SAVED:"Đã lưu trên server",DIRTY:"Có thay đổi chưa lưu",SAVING:"Đang lưu…",OFFLINE:"Chưa đồng bộ",CONFLICT:"Có xung đột phiên bản",CLOSED:"Đã khóa sửa bài",INVALID:"Nội dung chưa lưu được"})[save.status]}</strong>{save.savedAt&&<span>Lần lưu gần nhất {new Intl.DateTimeFormat("vi-VN",{hour:"2-digit",minute:"2-digit",second:"2-digit",timeZone:timezone}).format(new Date(save.savedAt))}</span>}</div>
      <div className="interview-actions"><Button type="button" variant="secondary" disabled={disabled||save.status==="SAVING"} onClick={()=>{void save.flush();}}><Save size={16} aria-hidden="true"/>Lưu ngay</Button><Button type="button" disabled={disabled} onClick={()=>setConfirm(true)}>Nộp bài<ArrowRight size={16} aria-hidden="true"/></Button></div>
    </div>
    {seconds===0&&<p className="notice" role="status">Đã hết thời gian. Câu trả lời đã khóa; hệ thống đang xác nhận bản lưu trên server. Thay đổi chưa đồng bộ không được tính.</p>}
    {save.error&&<p className="notice notice-error" role="alert">{save.error}</p>}
    {save.status==="CONFLICT"&&<section className="interview-recovery"><h2>Bản ở tab khác đã được lưu</h2><p>Thay đổi tại đây vẫn đang hiển thị để bạn có thể sao chép. Tải lại bản trên server sẽ bỏ thay đổi chưa lưu ở tab này.</p><Button variant="secondary" onClick={()=>{void save.reloadServer();}}>Dùng bản trên server</Button></section>}
    {save.recovery&&<section className="interview-recovery"><h2>Có bản lưu tạm chưa đồng bộ</h2><p>{save.recovery.answer_version===save.version?"Bản này chỉ được khôi phục khi bạn xác nhận. Nó chưa phải bài làm đã được server tiếp nhận.":"Bản trên server đã đổi phiên bản. Bản tạm không tự ghi đè lên câu trả lời của tab khác."}</p><div className="editor-actions"><Button disabled={save.recovery.answer_version!==save.version||seconds===0} onClick={save.restore}>Khôi phục bản tạm</Button><Button variant="secondary" onClick={()=>{void save.reloadServer();}}>Dùng bản trên server</Button></div></section>}
    {confirm&&seconds>0&&<section className="interview-confirm"><h2 tabIndex={-1} ref={confirmHeading}>Nộp và khóa bài làm?</h2><p>{unanswered>0?`Bạn còn ${unanswered} câu chưa trả lời. Câu bỏ trống được tính 0 điểm.`:"Bạn đã trả lời tất cả các câu."} Sau khi nộp bạn không thể sửa hoặc làm lại.</p><div className="editor-actions"><Button type="button" disabled={submitting||!!save.recovery||save.status==="CONFLICT"} onClick={()=>{void submit();}}>{submitting&&<LoaderCircle className="spin" size={16} aria-hidden="true"/>}Xác nhận nộp bài</Button><Button variant="secondary" disabled={submitting} onClick={()=>setConfirm(false)}>Tiếp tục làm bài</Button></div></section>}
    {error&&<p className="notice notice-error" role="alert">{error}</p>}
    <div className="interview-workspace"><nav className="interview-question-nav" aria-label="Điều hướng câu hỏi"><h2>Câu hỏi</h2><p>{questions.length-unanswered}/{questions.length} câu đã trả lời</p><div>{questions.map((q,i)=><button type="button" key={q.id} aria-current={i===active?"step":undefined} aria-label={`Câu ${i+1}, ${q.kind==="QUIZ"?"trắc nghiệm":"tự luận"}${hasAnswer(q.id,q.kind)?", đã trả lời":""}`} onClick={()=>setActive(i)}>{i+1}{hasAnswer(q.id,q.kind)&&<Check size={11} aria-hidden="true"/>}</button>)}</div><p className="field-hint">Trắc nghiệm 40% · Tự luận 60%</p></nav>
      <section className="interview-question"><h2 tabIndex={-1} ref={questionHeading}>Câu {active+1} · {question.kind==="QUIZ"?"Trắc nghiệm":"Tự luận"}</h2><p className="interview-prompt" id="interview-question-prompt">{question.prompt}</p>
        {question.kind==="QUIZ"?<fieldset disabled={disabled} className="interview-options" aria-labelledby="interview-question-prompt"><legend className="sr-only">Chọn một câu trả lời</legend>{question.options.map(option=><label key={option.id}><input type="radio" name={`answer-${question.id}`} value={option.id} checked={save.answers.quiz.find(a=>a.question_id===question.id)?.selected_answer===option.id} onChange={()=>save.change({...save.answers,quiz:[...save.answers.quiz.filter(a=>a.question_id!==question.id),{question_id:question.id,selected_answer:option.id}]})}/><span>{option.text}</span></label>)}<Button type="button" variant="ghost" onClick={()=>save.change({...save.answers,quiz:[...save.answers.quiz.filter(a=>a.question_id!==question.id),{question_id:question.id,selected_answer:null}]})}>Bỏ lựa chọn</Button></fieldset>
        :<div className="field"><label htmlFor={`essay-${question.id}`}>Câu trả lời tự luận</label><textarea className="input interview-essay" id={`essay-${question.id}`} disabled={disabled} maxLength={5000} aria-describedby="essay-length" value={save.answers.essay.find(a=>a.question_id===question.id)?.text??""} onChange={event=>save.change({...save.answers,essay:[...save.answers.essay.filter(a=>a.question_id!==question.id),{question_id:question.id,text:event.target.value}]})}/><p id="essay-length" className="field-hint">{save.answers.essay.find(a=>a.question_id===question.id)?.text.length??0}/5.000 ký tự. Chỉ dùng nội dung trả lời của bạn để đánh giá.</p></div>}
        <div className="interview-question-actions"><Button variant="secondary" disabled={active===0} onClick={()=>setActive(active-1)}><ArrowLeft size={16} aria-hidden="true"/>Câu trước</Button>{active<questions.length-1?<Button variant="secondary" onClick={()=>setActive(active+1)}>Câu tiếp<ArrowRight size={16} aria-hidden="true"/></Button>:<Button disabled={disabled} onClick={()=>setConfirm(true)}>Xem lại & nộp bài</Button>}</div>
      </section></div>
    <section className="interview-local-option"><label className="cv-checkbox"><input type="checkbox" checked={save.localEnabled} disabled={!!save.recovery||seconds===0} onChange={event=>save.enableLocal(event.target.checked)}/><span>Lưu tạm câu trả lời trên thiết bị này khi mất mạng. Không bật trên máy dùng chung.</span></label><p className="field-hint">Bản tạm chỉ hỗ trợ khôi phục, không kéo dài thời hạn. Hết hạn sau 24 giờ và được dọn khi mở lại bài; xóa khi nộp bài, đăng xuất hoặc tắt tùy chọn.</p></section>
  </div>;
}
