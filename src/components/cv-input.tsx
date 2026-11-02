"use client";
import { useRef,useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight,FileUp,LoaderCircle } from "lucide-react";
import { applySchema } from "@/domain/applications";
import { clientJSON } from "@/lib/client-api";
import { Button } from "./ui/button";
type Extracted={upload_id:string;source:"PDF"|"DOCX";text:string};
export function CVInput({jobId}:{jobId:string}){
  const router=useRouter();const [mode,setMode]=useState<"FILE"|"TEXT">("FILE");
  const [text,setText]=useState("");const [file,setFile]=useState<Extracted|null>(null);const [filename,setFilename]=useState("");
  const [busy,setBusy]=useState<"UPLOAD"|"SUBMIT"|null>(null);const [error,setError]=useState("");const [reviewed,setReviewed]=useState(false);
  const [acknowledged,setAcknowledged]=useState(false);const errorRef=useRef<HTMLDivElement>(null);
  const request=useRef<{body:string;key:string}|null>(null);
  function changeMode(next:"FILE"|"TEXT") {setMode(next);setText("");setFile(null);setFilename("");setReviewed(false);setError("");}
  function showError(message:string){setError(message);requestAnimationFrame(()=>errorRef.current?.focus());}
  async function readFile(selected:File){
    setError("");setFile(null);setText("");setReviewed(false);setFilename(selected.name);
    if(selected.size>5*1024*1024){showError("CV chỉ được tối đa 5 MiB. Hãy đổi file hoặc dán văn bản CV.");return;}
    const mime=selected.type||(/\.docx$/i.test(selected.name)?"application/vnd.openxmlformats-officedocument.wordprocessingml.document":/\.pdf$/i.test(selected.name)?"application/pdf":"");
    if(!["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(mime)){showError("Chỉ hỗ trợ file PDF hoặc DOCX. Hãy đổi file hoặc dán văn bản CV.");return;}
    setBusy("UPLOAD");
    try{
      const response=await fetch("/api/cv/uploads",{method:"POST",credentials:"same-origin",headers:{"Content-Type":mime},body:selected});
      const data=await response.json();if(!response.ok)throw new Error(data.error?.message??"Chưa tải được CV. Hãy thử lại.");
      const result=await clientJSON<Extracted>("/api/cv/extract","POST",{upload_id:data.upload_id});
      setFile(result);setText(result.text);
    }catch(error){showError(error instanceof Error?error.message:"Chưa đọc được CV. Hãy đổi file hoặc dán văn bản.");}
    finally{setBusy(null);}
  }
  async function submit(event:React.SubmitEvent<HTMLFormElement>){
    event.preventDefault();setError("");
    if(!reviewed){showError("Bạn cần đọc và xác nhận nội dung CV trước khi gửi.");return;}
    const parsed=applySchema.safeParse({cv_source:mode==="FILE"?file?.source:"TEXT",upload_id:mode==="FILE"?file?.upload_id:null,cv_text:text,ai_processing_acknowledged:acknowledged});
    if(!parsed.success){showError(parsed.error.issues[0]?.message??"Hãy kiểm tra nội dung CV.");return;}
    const body=JSON.stringify(parsed.data);if(request.current?.body!==body)request.current={body,key:crypto.randomUUID()};
    setBusy("SUBMIT");
    try{const result=await clientJSON<{application_id:string}>(`/api/jobs/${jobId}/applications`,"POST",parsed.data,{"Idempotency-Key":request.current!.key});router.push(`/candidate/applications/${result.application_id}`);}
    catch(error){showError(error instanceof Error?error.message:"Chưa gửi được hồ sơ. Hãy thử lại.");setBusy(null);}
  }
  return <form className="cv-form" onSubmit={submit}>
    <fieldset className="cv-methods" disabled={!!busy}><legend>Bạn muốn gửi CV bằng cách nào?</legend>
      <label><input type="radio" name="cv-method" checked={mode==="FILE"} onChange={()=>changeMode("FILE")}/>Tải PDF hoặc DOCX</label>
      <label><input type="radio" name="cv-method" checked={mode==="TEXT"} onChange={()=>changeMode("TEXT")}/>Dán văn bản</label>
    </fieldset>
    {mode==="FILE"&&<div className="cv-file-field"><label htmlFor="cv-file"><FileUp size={21} aria-hidden="true"/>Chọn file CV</label>
      <input id="cv-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={!!busy} aria-describedby="cv-file-help" onChange={event=>{const selected=event.target.files?.[0];if(selected)void readFile(selected);}}/>
      <p id="cv-file-help" className="field-hint">Tối đa 5 MiB, PDF 20 trang. PDF scan và file có mật khẩu chưa được hỗ trợ.</p>
      {filename&&<p className="cv-filename">{filename}</p>}
      {busy==="UPLOAD"&&<p role="status" className="cv-working"><LoaderCircle className="spin" size={17} aria-hidden="true"/>Đang tải và trích xuất văn bản…</p>}
    </div>}
    {(mode==="TEXT"||file)&&<section className="cv-review"><div className="field"><label htmlFor="cv-text">{mode==="FILE"?"Kiểm tra nội dung đã trích xuất":"Nội dung CV"}</label>
      <textarea id="cv-text" className="input cv-textarea" value={text} readOnly={mode==="FILE"} required minLength={100} maxLength={30000} disabled={busy==="SUBMIT"} aria-describedby="cv-text-help" onChange={event=>{setText(event.target.value);setReviewed(false);}}/>
      <p id="cv-text-help" className="field-hint">{text.trim().length.toLocaleString("vi-VN")}/30.000 ký tự · tối thiểu 100. {mode==="FILE"?"Nếu nội dung chưa đúng, chọn file khác hoặc chuyển sang dán văn bản.":"Chỉ gửi thông tin nghề nghiệp cần thiết; không cần số định danh hoặc thông tin nhạy cảm."}</p>
    </div></section>}
    {error&&<div className="notice notice-error" role="alert" tabIndex={-1} ref={errorRef}>{error}{mode==="FILE"&&<Button type="button" variant="ghost" size="small" disabled={!!busy} onClick={()=>changeMode("TEXT")}>Dán CV thay thế</Button>}</div>}
    <section className="cv-confirmation"><h2>Xác nhận trước khi gửi</h2>
      <label className="cv-checkbox"><input type="checkbox" checked={reviewed} required disabled={!!busy} onChange={event=>setReviewed(event.target.checked)}/><span>Tôi đã đọc và xác nhận nội dung CV hiển thị phía trên.</span></label>
      <label className="cv-checkbox"><input type="checkbox" checked={acknowledged} required disabled={!!busy} onChange={event=>setAcknowledged(event.target.checked)}/><span>Tôi đồng ý để CV được gửi đến dịch vụ AI để hỗ trợ đánh giá theo tiêu chí của vị trí. Nhà tuyển dụng xem hồ sơ và đưa ra quyết định cuối cùng.</span></label>
      <p className="field-hint">Mỗi tin chỉ nhận một hồ sơ từ bạn. Nội dung CV sẽ được cố định sau khi gửi.</p>
    </section>
    <div className="cv-submit-row"><Button type="submit" disabled={!!busy||(mode==="FILE"&&!file)}>{busy==="SUBMIT"?<><LoaderCircle className="spin" size={17} aria-hidden="true"/>Đang gửi hồ sơ…</>:<>Gửi hồ sơ ứng tuyển<ArrowRight size={17} aria-hidden="true"/></>}</Button><Link className="text-link" href="/candidate/applications">Xem hồ sơ đã nộp</Link></div>
  </form>;
}
