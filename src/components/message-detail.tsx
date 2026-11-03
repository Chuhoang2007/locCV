"use client";
import { useEffect,useState } from "react";
import Link from "@/components/loading-link";
import { ArrowLeft,ArrowRight } from "lucide-react";
import type { MessageDetail as Message } from "@/domain/messages";
import { clientJSON } from "@/lib/client-api";
import { Button } from "./ui/button";
export function MessageDetail({initial,timeZone}:{initial:Message;timeZone:string}){
  const [read,setRead]=useState(!!initial.read_at),[error,setError]=useState("");
  useEffect(()=>{if(initial.read_at)return;let active=true;void clientJSON("/api/inbox/"+initial.id,"POST").then(()=>{if(active){setRead(true);window.dispatchEvent(new Event("loccv-inbox-read"));}}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Chưa đánh dấu đã đọc.");});return()=>{active=false;};},[initial.id,initial.read_at]);
  async function mark(){try{await clientJSON("/api/inbox/"+initial.id,"POST");setRead(true);setError("");window.dispatchEvent(new Event("loccv-inbox-read"));}catch(e){setError(e instanceof Error?e.message:"Chưa đánh dấu đã đọc.");}}
  return <article className="message-detail"><Link className="text-link editor-back" href="/inbox"><ArrowLeft size={16} aria-hidden="true"/>Về hộp thư</Link><header className="page-heading"><h1>{initial.subject}</h1><p>{initial.job_title}</p></header><p className="field-hint"><time dateTime={initial.created_at}>{new Date(initial.created_at).toLocaleString("vi-VN",{timeZone})}</time> · {read?"Đã đọc":"Chưa đọc"}</p><p className="message-body">{initial.body}</p>{error&&<><p role="alert" className="notice notice-error">{error}</p><Button variant="secondary" onClick={mark}>Thử đánh dấu đã đọc</Button></>}<Button asChild><Link href={`/${initial.audience==="HR"?"hr":"candidate"}/applications/${initial.application_id}`}>Xem hồ sơ<ArrowRight size={16} aria-hidden="true"/></Link></Button></article>;
}
