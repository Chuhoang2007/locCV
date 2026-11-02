"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientJSON } from "@/lib/client-api";
import { Button } from "./ui/button";
export function CloseJobButton({id,version}:{id:string;version:number}){
  const router=useRouter();const [confirm,setConfirm]=useState(false);const [pending,setPending]=useState(false);const [error,setError]=useState("");
  return <div className="close-job"><Button variant="secondary" disabled={pending} onClick={()=>setConfirm(!confirm)}>Đóng tuyển</Button>{confirm&&<section className="close-confirm" aria-label="Xác nhận đóng tuyển"><h2>Dừng nhận hồ sơ mới?</h2><p>Tin sẽ được gỡ khỏi danh sách công khai. Các hồ sơ đã tiếp nhận vẫn được giữ nguyên.</p><div><Button variant="danger" disabled={pending} onClick={async()=>{setPending(true);setError("");try{await clientJSON(`/api/hr/jobs/${id}/close`,"POST",{expected_version:version});setConfirm(false);router.refresh();}catch(e){setError(e instanceof Error?e.message:"Chưa đóng được tin.");}finally{setPending(false);}}}>Xác nhận đóng tuyển</Button><Button variant="ghost" disabled={pending} onClick={()=>setConfirm(false)}>Giữ tin đang mở</Button></div>{error&&<p className="field-error" role="alert">{error}</p>}</section>}</div>;
}
