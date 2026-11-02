import "server-only";
import { AppError } from "@/lib/errors";

const errors: Record<string,[number,string]> = {
  DECISION_FINAL:[409,"HR đã chốt phản hồi cho hồ sơ này. Không thể thay đổi quyết định."],
  DECISION_VERSION_CONFLICT:[409,"Hồ sơ đã thay đổi. Hãy tải lại để xem kết quả mới nhất trước khi quyết định."],
  DECISION_NOT_ALLOWED:[409,"Hồ sơ chưa ở trạng thái cho phép quyết định này."],
  DELETION_PENDING:[409,"Tài khoản đã yêu cầu xóa dữ liệu. Hãy hủy yêu cầu trong Cài đặt nếu muốn tiếp tục."],
  DELETION_STARTED:[409,"Thời gian hủy đã kết thúc. Yêu cầu xóa đang được xử lý."],
  DATA_PURGING:[410,"Dữ liệu đã hết thời hạn lưu giữ và đang được xóa."],
  INTERVIEW_NOT_ELIGIBLE:[403,"Hồ sơ chưa đủ điều kiện bắt đầu bài thi."],
  INTERVIEW_NOT_STARTED:[409,"Bài thi chưa được bắt đầu."],
  INTERVIEW_NOT_DUE:[409,"Bài thi chưa hết thời gian."],
  INTERVIEW_CLOSED:[409,"Bài làm đã nộp hoặc đã hết thời gian. Không thể sửa câu trả lời."],
  ANSWER_VERSION_CONFLICT:[409,"Bài làm đã thay đổi ở tab khác. Hãy tải bản mới nhất trước khi tiếp tục."],
  INVALID_ANSWERS:[400,"Câu trả lời chưa hợp lệ. Hãy kiểm tra nội dung hoặc tải lại bài thi."],
  ESSAY_RETRY_LIMITED:[429,"Hồ sơ đã dùng hai lượt thử chấm lại tự luận trong 24 giờ. Hãy quay lại sau."],
  SELF_APPLICATION:[403,"Bạn không thể ứng tuyển tin do chính mình đăng, kể cả khi chuyển chế độ."],
  ALREADY_APPLIED:[409,"Bạn đã nộp hồ sơ cho tin này. Hãy xem trong Hồ sơ ứng tuyển."],
  JOB_NOT_OPEN:[409,"Tin này đã đóng và không nhận hồ sơ mới."],
  CV_UPLOAD_EXPIRED:[409,"File CV đã hết hạn hoặc đã được sử dụng. Hãy tải file lại hoặc dán văn bản."],
  CV_TEXT_CHANGED:[409,"Nội dung không khớp file đã trích xuất. Hãy chọn lại file hoặc chuyển sang dán văn bản."],
  CV_UNREADABLE:[422,"Không đọc được file này. Hãy đổi file hoặc dán văn bản CV."],
  CV_PARSING:[409,"File đang được xử lý. Hãy chờ một lát rồi thử lại."],
  CV_RATE_LIMITED:[429,"Bạn đã tải 10 file trong một giờ. Hãy dán văn bản CV hoặc thử lại sau."],
  CV_RETRY_LIMITED:[429,"Hồ sơ đã dùng hai lượt thử chấm lại trong 24 giờ. Hãy thử lại sau."],
  NOT_FOUND: [404,"Không tìm thấy nội dung này."], VERSION_CONFLICT: [409,"Bản nháp đã thay đổi ở nơi khác. Hãy tải bản mới nhất trước khi tiếp tục."],
  JOB_NOT_DRAFT: [409,"Chỉ chỉnh sửa được tin đang ở trạng thái nháp."], JOB_NOT_PUBLISHED: [409,"Tin này không còn mở tuyển."],
  ACTIVE_TASK: [409,"Tin này đã có một tác vụ AI đang chạy. Vui lòng chờ kết quả."], RATE_LIMITED: [429,"Bạn đã đạt giới hạn tạo nháp. Hãy thử lại sau."],
  INVALID_DRAFT: [422,"Chưa thể đăng tin. Hãy kiểm tra nội dung, tổng điểm CV bằng 100, đáp án và thang điểm tự luận."],
  INVALID_INPUT: [400,"Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại."], IDEMPOTENCY_CONFLICT: [409,"Yêu cầu đã thay đổi. Hãy tải lại trang rồi gửi lại."],
  TASK_NOT_RETRYABLE: [409,"Tác vụ này không còn có thể thử lại. Hãy tải bản mới nhất."],
};
export async function dbResult<T>(query: PromiseLike<{data:T;error:{message:string;code?:string}|null}>): Promise<NonNullable<T>> {
  const { data,error } = await query;
  if (error) {
    const entry = errors[error.message];
    if (entry) throw new AppError(error.message,entry[0],entry[1]);
    throw new AppError("DATABASE_UNAVAILABLE",503,"Chưa thể truy cập dữ liệu. Vui lòng thử lại sau.");
  }
  return data as NonNullable<T>;
}
