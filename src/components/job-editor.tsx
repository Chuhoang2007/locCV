"use client";
import Link from "@/components/loading-link";
import { useCallback,useEffect,useRef,useState } from "react";
import { useFeedbackRouter as useRouter } from "@/hooks/use-feedback-router";
import { ArrowLeft,ArrowUpRight,Check,LoaderCircle,Save,Sparkles } from "lucide-react";
import type { JobEditorData,OwnedJob } from "@/domain/job-dto";
import { emptyDraft,editableDraftSchema,type EditableDraft } from "@/domain/jobs";
import { isTaskActive } from "@/domain/task";
import { useTask } from "@/hooks/use-task";
import { clientJSON,ClientAPIError } from "@/lib/client-api";
import { Button } from "./ui/button";
import { RubricEditor,type DraftChange } from "./rubric-editor";
import { AssessmentEditor } from "./assessment-editor";
import { TaskProgress } from "./task-progress";
import { JobDescription,salaryLabel } from "./job-description";
import { validationFeedback,validationTarget,type ValidationFeedback } from "@/domain/validation";
import { EditorValidationContext,EditorInput as Input,EditorTextarea } from "./editor-field";

function draftFrom(job:OwnedJob):EditableDraft{const initial=emptyDraft();return {jd:job.jd_json??initial.jd,scoring_rubric:job.scoring_rubric_json??initial.scoring_rubric,interview_questions:job.interview_questions_json??initial.interview_questions,interview_access_policy:job.interview_access_policy};}
const tabs=["Mô tả công việc","Tiêu chí CV","Bài thi","Xem trước"];
export function JobEditor({initial}:{initial:JobEditorData}){
  const router=useRouter();const [job,setJob]=useState(initial.job);const [draft,setDraft]=useState(()=>draftFrom(initial.job));
  const [skills,setSkills]=useState(draft.jd.skills.join(", "));const [prompt,setPrompt]=useState(job.raw_hr_prompt??"");
  const [tab,setTab]=useState(0);const [dirty,setDirty]=useState(false);const dirtyRef=useRef(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [message,setMessage]=useState("");
  const [remote,setRemote]=useState<JobEditorData|null>(null);const [confirmPublish,setConfirmPublish]=useState(false);
  const [feedback,setFeedback]=useState<ValidationFeedback[]>([]);
  const {task,setTask,error:pollError}=useTask(initial.task);
  const processed=useRef(initial.task && !isTaskActive(initial.task.state)?initial.task.id:null);
  const requestKey=useRef<{payload:string;key:string}|null>(null);
  const active=Boolean(task&&isTaskActive(task.state));
  const total=draft.scoring_rubric.criteria.reduce((n,c)=>n+c.max_points,0);
  const fieldErrors=Object.fromEntries(feedback.map(f=>[validationTarget(f.path,draft).id,f.message]));
  const firstInvalid=feedback[0]?validationTarget(feedback[0].path,draft).id:null;
  const showValidation=(fields:ValidationFeedback[])=>{setFeedback(fields);setConfirmPublish(false);if(fields[0])setTab(validationTarget(fields[0].path,draft).tab);};
  useEffect(()=>{if(firstInvalid){const control=document.getElementById(firstInvalid);control?.focus();control?.scrollIntoView({block:"center",behavior:"instant"});}},[firstInvalid,feedback,tab]);
  const markDirty=()=>{dirtyRef.current=true;setDirty(true);setMessage("");setConfirmPublish(false);};
  const change:DraftChange=fn=>{setDraft(old=>{const next=structuredClone(old);fn(next);return next;});markDirty();};
  const adopt=useCallback((data:JobEditorData,keep=false)=>{
    setJob(data.job);setTask(data.task);setRemote(null);
    if(!keep){const next=draftFrom(data.job);setDraft(next);setSkills(next.jd.skills.join(", "));setPrompt(data.job.raw_hr_prompt??"");dirtyRef.current=false;setDirty(false);}
  },[setTask]);
  const refresh=useCallback(async()=>{
    const data=await clientJSON<JobEditorData>(`/api/hr/jobs/${initial.job.id}`,"GET");
    if(dirtyRef.current)setRemote(data);else adopt(data);
  },[initial.job.id,adopt]);
  useEffect(()=>{
    if(!task || isTaskActive(task.state) || processed.current===task.id)return;
    processed.current=task.id;
    void refresh().catch(()=>setError("Chưa tải được bản nháp mới nhất. Hãy tải lại trang để tiếp tục."));
  },[task,refresh]);
  useEffect(()=>{
    if(!dirty)return;
    const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();};
    window.addEventListener("beforeunload",beforeUnload);return()=>window.removeEventListener("beforeunload",beforeUnload);
  },[dirty]);
  async function action(work:()=>Promise<void>){setBusy(true);setError("");setMessage("");setFeedback([]);try{await work();}catch(e){if(e instanceof ClientAPIError&&e.status===401){router.push("/login");return;}setError(e instanceof Error?e.message:"Chưa hoàn tất được thao tác.");if(e instanceof ClientAPIError&&e.fields?.length)showValidation(e.fields);if(e instanceof ClientAPIError&&e.status===409)await refresh().catch(()=>undefined);}finally{setBusy(false);}}
  async function save(){await action(async()=>{
    const next=structuredClone(draft);next.jd.skills=skills.split(",").map(s=>s.trim()).filter(Boolean);
    for(const field of ["responsibilities","requirements","benefits"] as const)next.jd[field]=next.jd[field].map(s=>s.trim()).filter(Boolean);
    const parsed=editableDraftSchema.safeParse(next);if(!parsed.success){setError("Hãy sửa các trường được đánh dấu trước khi lưu.");showValidation(validationFeedback(parsed.error.issues));return;}
    const data=await clientJSON<{job:OwnedJob}>(`/api/hr/jobs/${job.id}`,"PATCH",{expected_version:job.version,draft:parsed.data});
    adopt({job:data.job,task});setMessage("Đã lưu bản nháp.");
  });}
  async function generate(retry=false){await action(async()=>{
    const payload=JSON.stringify({id:job.id,version:job.version,prompt,retry:retry?task?.id:null});
    if(requestKey.current?.payload!==payload)requestKey.current={payload,key:crypto.randomUUID()};
    await clientJSON(retry?`/api/tasks/${task!.id}/retry`:`/api/hr/jobs/${job.id}/generate`,"POST",retry?undefined:{expected_version:job.version,raw_hr_prompt:prompt},{"Idempotency-Key":requestKey.current.key});
    requestKey.current=null;await refresh();
  });}
  async function publish(){await action(async()=>{
    const data=await clientJSON<{job:OwnedJob}>(`/api/hr/jobs/${job.id}/publish`,"POST",{expected_version:job.version});
    setJob(data.job);router.push(`/hr/jobs/${job.id}`);router.refresh();
  });}
  return <EditorValidationContext.Provider value={fieldErrors}><div className="job-editor"><Link href="/hr" className="text-link editor-back"><ArrowLeft size={16} aria-hidden="true"/>Tin tuyển dụng của tôi</Link>
    <header className="editor-heading"><div><h1>{draft.jd.title||"Tin tuyển dụng mới"}</h1><p><span className="status-badge status-draft">Bản nháp</span><span>{dirty?"Có thay đổi chưa lưu":"Chưa hiển thị công khai"}</span></p></div><div className="editor-actions"><Button variant="secondary" disabled={busy||!dirty||Boolean(remote)} onClick={save}>{busy?<LoaderCircle size={16} className="spin" aria-hidden="true"/>:<Save size={16} aria-hidden="true"/>}Lưu nháp</Button><Button disabled={busy||dirty||active||Boolean(remote)||total!==100||!draft.interview_questions.quiz.length||!draft.interview_questions.essay.length} onClick={()=>setConfirmPublish(true)}><Check size={16} aria-hidden="true"/>Duyệt & đăng tuyển</Button></div></header>
    {dirty&&<p className="editor-save-hint">Lưu bản nháp trước khi duyệt đăng hoặc tạo lại bằng AI.</p>}
    {error&&<div className="notice notice-error" role="alert"><div><p>{error}</p><button className="text-link" type="button" onClick={()=>refresh().catch(()=>setError("Chưa tải được bản mới. Vui lòng thử lại."))}>Kiểm tra bản mới nhất</button></div></div>}
    {message&&<p className="saved-message" role="status"><Check size={16} aria-hidden="true"/>{message}</p>}
    {remote&&<div className="remote-notice" role="status"><h2>Có bản nháp mới trên hệ thống.</h2><p>Bạn đang có thay đổi chưa lưu. Chọn nội dung muốn tiếp tục chỉnh sửa.</p><div><Button size="small" onClick={()=>adopt(remote)}>Nạp bản mới</Button><Button size="small" variant="secondary" onClick={()=>adopt(remote,true)}>Giữ chỉnh sửa của tôi</Button></div></div>}
    {confirmPublish&&<section className="publish-confirm" aria-label="Xác nhận đăng tuyển"><h2>Đăng tin tuyển dụng này?</h2><p>JD, tiêu chí và bài thi sẽ được cố định sau khi đăng. Tin sẽ xuất hiện trong danh sách việc làm công khai.</p><div><Button onClick={publish} disabled={busy} loading={busy}>Xác nhận đăng tin</Button><Button variant="ghost" disabled={busy} onClick={()=>setConfirmPublish(false)}>Quay lại chỉnh sửa</Button></div></section>}
    <TaskProgress task={task} pollError={pollError} onRetry={()=>generate(true)} busy={busy||dirty||Boolean(remote)}/>
    <details className="ai-request" open={!job.jd_json}><summary><Sparkles size={17} aria-hidden="true"/>Yêu cầu tạo nháp bằng AI</summary><label htmlFor="regenerate-prompt">Mô tả nhu cầu tuyển dụng</label><EditorTextarea id="regenerate-prompt" className="input textarea" rows={4} value={prompt} maxLength={8000} disabled={active} onChange={e=>setPrompt(e.target.value)}/><div><p>AI tạo lại toàn bộ JD, tiêu chí và bài thi. Nội dung mới vẫn cần bạn duyệt.</p><Button variant="secondary" disabled={busy||active||dirty||Boolean(remote)||prompt.trim().length<10} loading={busy} onClick={()=>generate(false)}><Sparkles size={15} aria-hidden="true"/>Tạo lại toàn bộ bản nháp</Button></div></details>
    <div className="editor-tabs" role="tablist" aria-label="Các phần bản nháp">{tabs.map((label,i)=><button type="button" key={label} id={`editor-tab-${i}`} role="tab" aria-selected={tab===i} aria-controls={`editor-panel-${i}`} tabIndex={tab===i?0:-1} onKeyDown={e=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(e.key)){e.preventDefault();const index=e.key==="Home"?0:e.key==="End"?3:(tab+(e.key==="ArrowRight"?1:3))%4;setTab(index);document.getElementById(`editor-tab-${index}`)?.focus();}}} onClick={()=>setTab(i)}>{label}{i===1&&<span>{total}/100</span>}</button>)}</div>
    <div role="tabpanel" id={`editor-panel-${tab}`} aria-labelledby={`editor-tab-${tab}`} tabIndex={0} className="editor-panel">
      {tab===0&&<section className="editor-section"><div className="editor-section-heading"><div><h2>Mô tả công việc</h2><p>Nội dung bên dưới sẽ hiển thị công khai sau khi bạn đăng tuyển.</p></div></div><div className="field"><label htmlFor="job-title">Tên vị trí tuyển dụng</label><Input id="job-title" maxLength={180} value={draft.jd.title} onChange={e=>change(d=>{d.jd.title=e.target.value;})}/></div><div className="field"><label htmlFor="job-summary">Tóm tắt công việc</label><EditorTextarea id="job-summary" className="input textarea" rows={4} maxLength={4000} value={draft.jd.summary} onChange={e=>change(d=>{d.jd.summary=e.target.value;})}/></div><div className="editor-inline-fields"><div className="field"><label htmlFor="job-location">Địa điểm làm việc</label><Input id="job-location" maxLength={180} value={draft.jd.location} onChange={e=>change(d=>{d.jd.location=e.target.value;})}/></div><div className="field"><label htmlFor="job-skills">Kỹ năng, cách nhau bằng dấu phẩy</label><Input id="job-skills" maxLength={3000} value={skills} onChange={e=>{setSkills(e.target.value);markDirty();}}/></div></div><div className="editor-inline-fields"><div className="field"><label htmlFor="salary-min">Lương từ (VND/tháng)</label><Input id="salary-min" type="number" min={0} value={draft.jd.salary_min??""} placeholder="Để trống nếu thỏa thuận" onChange={e=>change(d=>{d.jd.salary_min=e.target.value===""?null:Number(e.target.value);})}/></div><div className="field"><label htmlFor="salary-max">Lương đến (VND/tháng)</label><Input id="salary-max" type="number" min={0} value={draft.jd.salary_max??""} placeholder="Để trống nếu thỏa thuận" onChange={e=>change(d=>{d.jd.salary_max=e.target.value===""?null:Number(e.target.value);})}/></div></div>{([ ["responsibilities","Trách nhiệm công việc"],["requirements","Yêu cầu ứng viên"],["benefits","Quyền lợi"] ] as const).map(([key,label])=><div className="field" key={key}><label htmlFor={`job-${key}`}>{label}</label><EditorTextarea id={`job-${key}`} className="input textarea" rows={5} maxLength={80000} value={draft.jd[key].join("\n")} onChange={e=>change(d=>{d.jd[key]=e.target.value.split("\n");})}/><p className="field-hint">Mỗi dòng là một mục. Tối đa 20 mục, 4.000 ký tự mỗi mục.</p></div>)}</section>}
      {tab===1&&<RubricEditor draft={draft} change={change}/>}{tab===2&&<AssessmentEditor draft={draft} change={change}/>}
      {tab===3&&<section className="editor-preview"><h2>{draft.jd.title||"Tên vị trí tuyển dụng"}</h2><p className="preview-meta">{draft.jd.location||"Địa điểm chưa nhập"} · {salaryLabel(draft.jd.salary_min,draft.jd.salary_max)}</p><JobDescription jd={draft.jd}/><section className="internal-preview"><h2>Phần đánh giá dành riêng HR</h2><p>CV: {total}/100 điểm, ngưỡng {draft.scoring_rubric.pass_threshold}. Bài thi: {draft.interview_questions.duration_minutes} phút.</p><ul>{draft.scoring_rubric.criteria.map(c=><li key={c.id}><strong>{c.label||"Tiêu chí chưa đặt tên"} ({c.max_points} điểm)</strong><p>{c.scoring_guidance}</p></li>)}</ul><h3>Trắc nghiệm</h3>{draft.interview_questions.quiz.map((q,i)=><div className="preview-question" key={q.id}><strong>{i+1}. {q.prompt}</strong><ul>{q.options.map(o=><li key={o.id}>{o.text}{o.id===q.correct_answer&&<span className="correct-answer"> — Đáp án đúng</span>}</li>)}</ul></div>)}<h3>Tự luận</h3>{draft.interview_questions.essay.map((q,i)=><div className="preview-question" key={q.id}><strong>{i+1}. {q.prompt} ({q.max_points} điểm)</strong><ul>{q.rubric.map(c=><li key={c.id}>{c.description} ({c.max_points} điểm): {c.scoring_guidance}</li>)}</ul></div>)}</section><p className="field-hint">Chỉ JD và thông tin kỳ thi được công khai. Đáp án và hướng dẫn chấm không gửi cho ứng viên.</p></section>}
    </div><div className="editor-bottom-link"><Link href={`/hr/jobs/${job.id}`} className="text-link">Xem trạng thái tin<ArrowUpRight size={15} aria-hidden="true"/></Link></div>
  </div></EditorValidationContext.Provider>;
}
