"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight,Mail } from "lucide-react";
import type { InboxPage } from "@/domain/messages";
import { clientJSON } from "@/lib/client-api";
import { Button } from "./ui/button";
export function InboxList({initial,unread,timeZone}:{initial:InboxPage;unread:boolean;timeZone:string}){
  const [data,setData]=useState(initial),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  async function more(){setBusy(true);setError("");try{const next=await clientJSON<InboxPage>(`/api/inbox?unread=${unread}&cursor=${encodeURIComponent(data.next_cursor!)}`,"GET");setData(old=>({...next,items:[...old.items,...next.items.filter(x=>!old.items.some(y=>y.id===x.id))]}));}catch(e){setError(e instanceof Error?e.message:"Chưa tải được thư.");}finally{setBusy(false);}}
  return <><p className="field-hint" aria-live="polite">{data.unread_count} thông báo chưa đọc</p><nav className="inbox-filters" aria-label="Lọc hộp thư"><Link href="/inbox" aria-current={!unread?"page":undefined}>Tất cả</Link><Link href="/inbox?unread=true" aria-current={unread?"page":undefined}>Chưa đọc</Link></nav>
    {data.items.length?<ul className="inbox-list">{data.items.map(item=><li key={item.id}><Link href={`/inbox/${item.id}`} className="inbox-item"><span className="inbox-item-content"><strong>{item.subject}</strong><span>{item.job_title}</span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString("vi-VN",{timeZone})}</time></span><span className="inbox-item-state">{!item.read_at&&<span className="status-badge">Chưa đọc</span>}<ArrowRight size={18} aria-hidden="true"/></span></Link></li>)}</ul>:<div className="inbox-empty"><Mail size={32} aria-hidden="true"/><h2>{unread?"Bạn đã đọc hết thông báo":"Hộp thư đang trống"}</h2><p>Thông báo về hồ sơ và phản hồi từ HR sẽ xuất hiện tại đây.</p><Link className="text-link" href="/jobs">Khám phá việc làm<ArrowRight size={16} aria-hidden="true"/></Link></div>}
    {error&&<p role="alert" className="notice notice-error">{error}</p>}{data.next_cursor&&<Button variant="secondary" disabled={busy} onClick={more}>{busy?"Đang tải…":"Xem thông báo cũ hơn"}</Button>}
  </>;
}
