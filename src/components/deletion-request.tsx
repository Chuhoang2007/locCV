"use client";
import { useState } from "react";
import type { DeletionStatus } from "@/domain/messages";
import { clientJSON } from "@/lib/client-api";
import { Button } from "./ui/button";
export function DeletionRequest({initial,retentionEnabled,timeZone}:{initial:DeletionStatus;retentionEnabled:boolean;timeZone:string}){
  const [status,setStatus]=useState(initial),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(requested:boolean){setBusy(true);setError("");try{setStatus(await clientJSON<DeletionStatus>("/api/me/deletion-request","POST",{requested}));setConfirm(false);}catch(e){setError(e instanceof Error?e.message:"Chưa gửi được yêu cầu.");}finally{setBusy(false);}}
  return <section className="settings-section">
    <div className="section-description"><h2>Dữ liệu & quyền riêng tư</h2><p>{!retentionEnabled&&"Chính sách dự kiến: "}CV, bài làm và kết quả lưu tối đa 180 ngày tính từ phản hồi của HR, hoặc từ khi nộp nếu chưa có phản hồi.</p></div>
    <div className="deletion-content">
      {!retentionEnabled&&<p className="notice">Tự động xóa dữ liệu hiện chưa được kích hoạt. Yêu cầu của bạn vẫn được ghi nhận để đơn vị vận hành xử lý.</p>}
      {status.requested_at?<>
        <h3>Đã tiếp nhận yêu cầu xóa</h3><p role="status">Thời hạn hủy yêu cầu: {new Date(status.scheduled_at!).toLocaleString("vi-VN",{timeZone})}. {retentionEnabled?"Dữ liệu sẽ được đưa vào quy trình xóa sau thời điểm này.":"Yêu cầu sẽ chờ đơn vị vận hành xử lý sau thời điểm này."}</p>
        <p>Tin đang tuyển đã đóng. Hủy yêu cầu không mở lại tin.</p><Button variant="secondary" disabled={busy} onClick={()=>submit(false)}>{busy?"Đang xử lý…":"Hủy yêu cầu xóa"}</Button>
      </>:confirm?<>
        <h3>Xác nhận yêu cầu xóa dữ liệu?</h3><p>Tin đang tuyển sẽ đóng ngay. Bạn có 7 ngày để hủy. Phạm vi xóa gồm tài khoản, CV, bài làm, kết quả và các hồ sơ thuộc tin của bạn.</p>
        <p>Bản sao lưu có lịch lưu giữ riêng do đơn vị vận hành công bố.</p><div className="action-row"><Button disabled={busy} onClick={()=>submit(true)}>{busy?"Đang gửi…":"Xác nhận yêu cầu xóa"}</Button><Button variant="secondary" disabled={busy} onClick={()=>setConfirm(false)}>Giữ tài khoản</Button></div>
      </>:<><h3>Yêu cầu xóa tài khoản</h3><p>Xem phạm vi xóa và thời gian chờ trước khi gửi yêu cầu.</p><Button variant="secondary" onClick={()=>setConfirm(true)}>Yêu cầu xóa dữ liệu</Button></>}
      {error&&<p role="alert" className="notice notice-error">{error}</p>}
    </div>
  </section>;
}
