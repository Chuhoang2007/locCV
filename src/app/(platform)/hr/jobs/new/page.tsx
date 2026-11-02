import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewJobForm } from "@/components/new-job-form";
import { requireViewer } from "@/server/auth";
export const metadata={title:"Tạo tin tuyển dụng"};
export default async function NewJob(){
  await requireViewer();
  return <div><Link href="/hr" className="text-link editor-back"><ArrowLeft size={16} aria-hidden="true"/>Tin tuyển dụng của tôi</Link><header className="page-heading"><h1>Tìm đúng người, từ một bản nháp tốt.</h1><p>Bắt đầu bằng nhu cầu của bạn. Cùng AI hoàn thiện phần còn lại.</p></header><NewJobForm/></div>;
}
