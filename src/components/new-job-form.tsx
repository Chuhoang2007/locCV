"use client";
import { useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight,LoaderCircle,Sparkles } from "lucide-react";
import { createJobSchema } from "@/domain/jobs";
import { clientJSON } from "@/lib/client-api";
import { Button } from "./ui/button";

export function NewJobForm(){
  const router=useRouter();const [prompt,setPrompt]=useState("");const [pending,setPending]=useState(false);const [error,setError]=useState("");
  const key=useRef<{body:string;key:string}|null>(null);
  async function create(generate:boolean){
    const body={raw_hr_prompt:prompt,generate};const parsed=createJobSchema.safeParse(body);
    if(!parsed.success){setError("Mô tả cần ít nhất 10 ký tự và không vượt 8.000 ký tự để AI tạo nháp.");return;}
    const text=JSON.stringify(parsed.data);if(key.current?.body!==text)key.current={body:text,key:crypto.randomUUID()};
    setPending(true);setError("");
    try{const data=await clientJSON<{job_id:string}>("/api/hr/jobs","POST",parsed.data,{"Idempotency-Key":key.current.key});router.push(`/hr/jobs/${data.job_id}/edit`);router.refresh();}
    catch(e){setError(e instanceof Error?e.message:"Chưa tạo được tin nháp.");setPending(false);}
  }
  return <div className="new-job-layout"><form onSubmit={e=>{e.preventDefault();void create(true);}} className="new-job-form">
    <label htmlFor="raw_hr_prompt">Bạn đang tìm người như thế nào?</label>
    <p className="field-hint">Mô tả vị trí, kỹ năng, kinh nghiệm và điều bạn coi trọng. Bạn sẽ duyệt toàn bộ nội dung trước khi đăng.</p>
    <textarea id="raw_hr_prompt" className="input textarea prompt-area" value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={8000} rows={10} placeholder={"Ví dụ: Tuyển Frontend Developer, dùng React và TypeScript. Có kinh nghiệm kiểm thử, làm việc tại Hà Nội. Lương 20–30 triệu đồng/tháng."} aria-describedby="prompt-count"/>
    <p id="prompt-count" className="character-count">{prompt.length.toLocaleString("vi-VN")} / 8.000 ký tự</p>
    {error&&<div role="alert" className="notice notice-error">{error}</div>}
    <div className="new-job-actions"><Button type="submit" disabled={pending}>{pending?<LoaderCircle size={17} className="spin" aria-hidden="true"/>:<Sparkles size={17} aria-hidden="true"/>}Tạo bản nháp bằng AI</Button><Button type="button" variant="ghost" disabled={pending} onClick={()=>create(false)}>Soạn thủ công<ArrowRight size={16} aria-hidden="true"/></Button></div>
  </form><aside className="draft-guide"><h2>Một yêu cầu.<br/>Ba phần sẵn sàng duyệt.</h2><ol><li><strong>Mô tả công việc</strong><p>JD có cấu trúc rõ ràng, tập trung vào vị trí bạn cần tuyển.</p></li><li><strong>Tiêu chí lọc CV</strong><p>Thang điểm 100, có trọng số và ngưỡng qua vòng CV.</p></li><li><strong>Bài thi chuyên môn</strong><p>Trắc nghiệm và câu hỏi tình huống, kèm thang điểm dành cho HR.</p></li></ol><p>AI tạo nháp. Bạn giữ quyền quyết định.</p></aside></div>;
}
