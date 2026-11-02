import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { taskDTOSchema } from "@/domain/task";
import { dbResult } from "./rpc";
import { generateJob, getOwnedJob, jobId } from "./dal/jobs";
import { getApplicationTask,getEssayTask,retryCVTask,retryEssayTask } from "./dal/applications";

export async function getTask(actor: string, id: string) {
  const data = await dbResult(createAdminClient().from("ai_tasks").select("id,job_id,application_id,requested_by_user_id,kind,state,network_attempts,available_at,error_code,updated_at")
    .eq("id",jobId(id)).maybeSingle());
  if(data&&["EVALUATE_CV","EVALUATE_ESSAY"].includes(data.kind)&&data.application_id){
    const task=await (data.kind==="EVALUATE_ESSAY"?getEssayTask:getApplicationTask)(actor,data.application_id);
    if(!task||task.id!==id)throw new AppError("NOT_FOUND",404,"Không tìm thấy tác vụ này.");
    return task;
  }
  if(data?.requested_by_user_id!==actor)throw new AppError("NOT_FOUND",404,"Không tìm thấy tác vụ này.");
  if (!data || data.kind !== "GENERATE_JOB" || !data.job_id) throw new AppError("NOT_FOUND",404,"Không tìm thấy tác vụ này.");
  const owned = await getOwnedJob(data.job_id,actor);
  return taskDTOSchema.parse({id:data.id,job_id:data.job_id,state:data.state,attempt:data.network_attempts,max_attempts:3,
    next_retry_at:data.state === "RETRY_WAIT" ? data.available_at : null,error_code:data.error_code,
    can_retry:data.state === "FAILED" && owned.job.status === "DRAFT" && owned.task?.id === data.id,updated_at:data.updated_at});
}
export async function retryTask(actor: string, id: string, key: string) {
  const task = await getTask(actor,id);
  if(task.kind==="EVALUATE_ESSAY")return retryEssayTask(actor,id,key);
  if(task.application_id)return retryCVTask(actor,id,key);
  const {job} = await getOwnedJob(task.job_id,actor);
  // SQL kiểm tra lại FAILED/latest trong cùng transaction; không reset budget cũ.
  return generateJob(actor,job.id,{expected_version:job.version,raw_hr_prompt:job.raw_hr_prompt??""},key,id);
}
