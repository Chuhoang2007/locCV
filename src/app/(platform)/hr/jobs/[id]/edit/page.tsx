import { notFound,redirect } from "next/navigation";
import { JobEditor } from "@/components/job-editor";
import { requireViewer } from "@/server/auth";
import { getOwnedJob } from "@/server/dal/jobs";
import { AppError } from "@/lib/errors";
export const metadata={title:"Chỉnh sửa bản nháp"};
export default async function EditJob({params}:{params:Promise<{id:string}>}){
  const viewer=await requireViewer();const {id}=await params;
  const data=await getOwnedJob(id,viewer.id).catch(error=>{if(error instanceof AppError&&[400,404].includes(error.status))notFound();throw error;});
  if(data.job.status!=="DRAFT")redirect(`/hr/jobs/${id}`);
  return <JobEditor initial={data}/>;
}
