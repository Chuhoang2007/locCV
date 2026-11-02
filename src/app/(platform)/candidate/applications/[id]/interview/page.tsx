import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth";
import { getInterview } from "@/server/dal/interviews";
import { AppError } from "@/lib/errors";
import { InterviewRunner } from "@/components/interview-runner";
export const metadata={title:"Bài thi tuyển dụng"};
export default async function Interview({params}:{params:Promise<{id:string}>}){
  const viewer=await requireViewer();const {id}=await params;
  const initial=await getInterview(viewer.id,id).catch(error=>{if(error instanceof AppError&&[400,404].includes(error.status))notFound();throw error;});
  return <InterviewRunner initial={initial} userId={viewer.id} timezone={viewer.profile.timezone}/>;
}
