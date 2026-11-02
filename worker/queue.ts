import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getServerEnv } from "../src/lib/env.js";
import type { Database } from "../src/lib/db.types.js";
import type { SubmissionStore } from "../src/server/interview-submission.js";

const taskSchema = z.object({id:z.uuid(),job_id:z.uuid().nullable(),application_id:z.uuid().nullable().optional(),kind:z.enum(["GENERATE_JOB","EVALUATE_CV","EVALUATE_ESSAY"]),input_version:z.number().int(),
  network_attempts:z.number().int().min(0).max(3),model:z.string(),prompt_version:z.string()});
export type GenerationTask = z.infer<typeof taskSchema>;
export interface QueueStore extends SubmissionStore {
  health(): Promise<void>;
  claim(lease: string): Promise<GenerationTask|null>;
  heartbeat(task: string,lease: string): Promise<boolean>;
  beginAttempt(task: string,lease: string,attempt: number): Promise<boolean>;
  retryWait(task: string,lease: string,next: string,code: string): Promise<boolean>;
  fail(task: string,lease: string,code: string): Promise<boolean>;
  complete(task: string,lease: string,result: unknown): Promise<boolean>;
  getJob(id: string): Promise<{version:number;status:string;raw_hr_prompt:string|null}>;
  getCV(id:string):Promise<{status:string;cv_score:number|null;cv_text:string;job_snapshot_json:unknown}>;
  completeCV(task:string,lease:string,result:unknown):Promise<boolean>;
  getEssay(id:string):Promise<{status:string;answer_version:number;interview_submitted_at:string|null;candidate_answers_json:unknown;job_snapshot_json:unknown;quiz_result_json:unknown}>;
  completeEssay(task:string,lease:string,result:unknown):Promise<boolean>;
  dueInterviews(limit:number):Promise<string[]>;
}
export function createQueueStore(): QueueStore {
  const {url,secret}=getServerEnv();
  const client=createClient<Database>(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
  async function result<T>(query: PromiseLike<{data:T;error:unknown}>):Promise<T>{
    const response=await query;
    if(response.error) throw new Error("QUEUE_DATABASE_ERROR");
    return response.data;
  }
  return {
    async health(){await result(client.rpc("lc_operations",{}));await result(client.rpc("lc_due_interviews",{p_limit:1}));},
    async claim(lease){const data=await result(client.rpc("lc_claim_task",{p_lease:lease}));return data ? taskSchema.parse(data):null;},
    async heartbeat(task,lease){return (await result(client.rpc("lc_heartbeat",{p_task:task,p_lease:lease})))===true;},
    async beginAttempt(task,lease,attempt){return (await result(client.rpc("lc_begin_attempt",{p_task:task,p_lease:lease,p_attempt:attempt})))===true;},
    async retryWait(task,lease,next,code){return (await result(client.rpc("lc_retry_wait",{p_task:task,p_lease:lease,p_next:next,p_code:code})))===true;},
    async fail(task,lease,code){return (await result(client.rpc("lc_fail_task",{p_task:task,p_lease:lease,p_code:code})))===true;},
    async complete(task,lease,data){return (await result(client.rpc("lc_complete_job",{p_task:task,p_lease:lease,p_result:data as Database["public"]["Functions"]["lc_complete_job"]["Args"]["p_result"]})))===true;},
    async getJob(id){const data=await result(client.from("jobs").select("version,status,raw_hr_prompt").eq("id",id).single());if(!data)throw new Error("JOB_NOT_FOUND");return data;},
    async getCV(id){const data=await result(client.from("applications").select("status,cv_score,cv_text,job_snapshot_json").eq("id",id).single());if(!data)throw new Error("APPLICATION_NOT_FOUND");return data;},
    async completeCV(task,lease,data){return (await result(client.rpc("lc_complete_cv",{p_task:task,p_lease:lease,p_result:data as Database["public"]["Functions"]["lc_complete_cv"]["Args"]["p_result"]})))===true;},
    async getEssay(id){const data=await result(client.from("applications").select("status,answer_version,interview_submitted_at,candidate_answers_json,job_snapshot_json,quiz_result_json").eq("id",id).single());if(!data)throw new Error("APPLICATION_NOT_FOUND");return data;},
    async completeEssay(task,lease,data){return (await result(client.rpc("lc_complete_essay",{p_task:task,p_lease:lease,p_result:data as Database["public"]["Functions"]["lc_complete_essay"]["Args"]["p_result"]})))===true;},
    async dueInterviews(limit){return z.array(z.uuid()).parse(await result(client.rpc("lc_due_interviews",{p_limit:limit})));},
    prepareSubmission:(actor,id,timeout)=>result(client.rpc("lc_prepare_submission",{p_actor:actor,p_application:id,p_timeout:timeout})),
    commitSubmission:input=>result(client.rpc("lc_submit_interview",{p_actor:input.actor,p_application:input.id,p_version:input.version,p_quiz:input.quiz as Database["public"]["Functions"]["lc_submit_interview"]["Args"]["p_quiz"],p_model:input.model,p_prompt_version:input.promptVersion,p_timeout:input.timeout})),
  };
}
