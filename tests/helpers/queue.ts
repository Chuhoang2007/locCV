import type { PGlite } from "@electric-sql/pglite";
import type { GenerationTask,QueueStore } from "../../worker/queue";
export async function sqlRPC<T>(db:PGlite,name:string,args:Record<string,unknown>):Promise<T>{
  if(!/^lc_[a-z_]+$/.test(name))throw new Error("Unsafe function name");
  const values=Object.values(args).map(value=>value!==null&&typeof value==="object"?JSON.stringify(value):value);
  const sql=`select public.${name}(${Object.keys(args).map((key,i)=>`${key} => $${i+1}`).join(",")}) as result`;
  return (await db.query<{result:T}>(sql,values)).rows[0].result;
}
export function pgQueue(db:PGlite):QueueStore{
  return {
    async health(){await db.query("select 1");},
    claim:lease=>sqlRPC<GenerationTask|null>(db,"lc_claim_task",{p_lease:lease}),
    heartbeat:(task,lease)=>sqlRPC(db,"lc_heartbeat",{p_task:task,p_lease:lease}),
    beginAttempt:(task,lease,attempt)=>sqlRPC(db,"lc_begin_attempt",{p_task:task,p_lease:lease,p_attempt:attempt}),
    retryWait:(task,lease,next,code)=>sqlRPC(db,"lc_retry_wait",{p_task:task,p_lease:lease,p_next:next,p_code:code}),
    fail:(task,lease,code)=>sqlRPC(db,"lc_fail_task",{p_task:task,p_lease:lease,p_code:code}),
    complete:(task,lease,result)=>sqlRPC(db,"lc_complete_job",{p_task:task,p_lease:lease,p_result:result}),
    async getJob(id){return (await db.query<{version:number;status:string;raw_hr_prompt:string|null}>("select version,status,raw_hr_prompt from public.jobs where id=$1",[id])).rows[0];},
    async getCV(id){return (await db.query<{status:string;cv_score:number|null;cv_text:string;job_snapshot_json:unknown}>("select status,cv_score,cv_text,job_snapshot_json from public.applications where id=$1",[id])).rows[0];},
    completeCV:(task,lease,result)=>sqlRPC(db,"lc_complete_cv",{p_task:task,p_lease:lease,p_result:result}),
    async getEssay(id){return (await db.query<{status:string;answer_version:number;interview_submitted_at:string|null;candidate_answers_json:unknown;job_snapshot_json:unknown;quiz_result_json:unknown}>("select status,answer_version,interview_submitted_at,candidate_answers_json,job_snapshot_json,quiz_result_json from public.applications where id=$1",[id])).rows[0];},
    completeEssay:(task,lease,result)=>sqlRPC(db,"lc_complete_essay",{p_task:task,p_lease:lease,p_result:result}),
    dueInterviews:limit=>sqlRPC(db,"lc_due_interviews",{p_limit:limit}),
    prepareSubmission:(actor,id,timeout)=>sqlRPC(db,"lc_prepare_submission",{p_actor:actor,p_application:id,p_timeout:timeout}),
    commitSubmission:input=>sqlRPC(db,"lc_submit_interview",{p_actor:input.actor,p_application:input.id,p_version:input.version,p_quiz:input.quiz,p_model:input.model,p_prompt_version:input.promptVersion,p_timeout:input.timeout}),
  };
}
