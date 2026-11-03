import { CheckCircle2,Clock3,Info,LoaderCircle } from "lucide-react";
import type { TaskDTO } from "@/domain/task";
import { Button } from "./ui/button";

const explanations:Record<string,string>={
  VERSION_CONFLICT:"Bản nháp đã được chỉnh sửa trong khi AI xử lý. Thay đổi của bạn được giữ nguyên.",
  UPSTREAM_AUTH:"Dịch vụ AI chưa được cấu hình quyền truy cập đúng. Bạn vẫn có thể soạn thủ công.",
  CONFIG_ERROR:"Dịch vụ AI chưa sẵn sàng. Bạn vẫn có thể soạn tin thủ công.",
  MODEL_UNAVAILABLE:"Model AI đang cấu hình không có trên gateway. Bạn vẫn có thể soạn thủ công trong khi cấu hình được cập nhật.",
  INVALID_OUTPUT:"AI trả dữ liệu chưa đúng cấu trúc hoặc thang điểm. Chưa có nội dung nào được ghi đè.",
  INVALID_JSON:"AI trả dữ liệu không đọc được. Bạn có thể tạo lại bản nháp.",
  TRUNCATED_OUTPUT:"Câu trả lời của AI chưa hoàn tất. Bạn có thể tạo lại bản nháp.",
  RATE_LIMITED:"Dịch vụ AI đang giới hạn yêu cầu. Vui lòng thử lại sau.",
};
export function TaskProgress({task,pollError,onRetry,busy}:{task:TaskDTO|null;pollError?:string;onRetry?:()=>void;busy?:boolean}){
  if(!task)return null;
  const done=task.state==="SUCCEEDED",failed=task.state==="FAILED";
  return <section className={`task-status ${failed?"task-status-error":done?"task-status-done":""}`} aria-label="Tiến trình tạo nháp" aria-live="polite">
    <div className="task-status-icon">{done?<CheckCircle2 size={20} aria-hidden="true"/>:failed?<Info size={20} aria-hidden="true"/>:task.state==="QUEUED"?<Clock3 size={20} aria-hidden="true"/>:<LoaderCircle size={20} className="spin" aria-hidden="true"/>}</div>
    <div><strong>{({QUEUED:"Đang chờ tạo bản nháp",RUNNING:"AI đang soạn nội dung",RETRY_WAIT:"Đang kết nối lại dịch vụ AI",SUCCEEDED:"Bản nháp AI đã sẵn sàng",FAILED:"Chưa thể hoàn tất bản nháp"})[task.state]}</strong>
      <p>{done?"Hãy đọc, chỉnh sửa và duyệt nội dung trước khi đăng.":failed?(explanations[task.error_code??""]??"Dịch vụ AI chưa phản hồi thành công. Bạn có thể thử lại hoặc soạn thủ công."):"Bạn có thể rời trang và quay lại. Dịch vụ AI có thể cần thời gian khởi động."}</p>
      {!done && !failed && task.attempt>0 && <span className="task-attempt">Lần kết nối {task.attempt}/{task.max_attempts}</span>}
      {pollError && <p className="field-error">{pollError}</p>}
    </div>
    {failed&&task.can_retry&&onRetry&&<Button variant="secondary" size="small" disabled={busy} loading={busy} onClick={onRetry}>Thử lại</Button>}
  </section>;
}
