import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth";
import { getApplication } from "@/server/dal/applications";
import { AppError } from "@/lib/errors";
import { EvaluationReport } from "@/components/evaluation-report";
export const metadata={title:"Đánh giá CV ứng viên"};
export default async function Application({params}:{params:Promise<{id:string}>}){
  const viewer=await requireViewer();const {id}=await params;
  const application=await getApplication(viewer.id,id).catch(error=>{if(error instanceof AppError&&[400,404].includes(error.status))notFound();throw error;});
  if(application.audience!=="HR")notFound();
  return <EvaluationReport initial={application} timeZone={viewer.profile.timezone}/>;
}
