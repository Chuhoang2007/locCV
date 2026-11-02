import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAISettings } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { PROMPT_VERSION,normalizeCandidateAnswers } from "@/lib/ai-client";
import { ScoringRubricSchema,InterviewQuestionsSchema } from "@/lib/ai-schemas";
import { interviewReportSchema,quizResultSchema } from "@/domain/interview";
import { applySchema,applicationCardSchema,applicationDetailSchema,applicationFiltersSchema,cvReportSchema,interviewEligibility } from "@/domain/applications";
import { decodeCursor,encodeCursor } from "@/domain/jobs";
import { taskDTOSchema } from "@/domain/task";
import { jobId,parseInput } from "./jobs";
import { requestHash } from "../idempotency";
import { dbResult } from "../rpc";

export async function applyToJob(actor:string,id:string,value:unknown,key:string){
  const input=parseInput(applySchema,value);const ai=getAISettings();
  return z.object({application_id:z.uuid()}).parse(await dbResult(createAdminClient().rpc("lc_apply",{
    p_actor:actor,p_job:jobId(id),p_source:input.cv_source,p_upload:input.upload_id,p_text:input.cv_text,p_ack:input.ai_processing_acknowledged,
    p_key:key,p_hash:requestHash(input),p_model:ai.model,p_prompt_version:PROMPT_VERSION,
  })));
}
export async function getApplicationRecord(actor:string,id:string){
  const client=createAdminClient();
  const record=await dbResult(client.from("applications").select("id,job_id,candidate_user_id,status,created_at,cv_source,cv_text,cv_storage_path,cv_score,cv_evaluation_json,job_snapshot_json,interview_score,interview_started_at,interview_deadline_at,interview_submitted_at,submission_reason,quiz_result_json,interview_evaluation_json,candidate_answers_json,version,hr_decision_message,hr_decided_at,purge_pending_at")
    .eq("id",jobId(id)).maybeSingle());
  if(!record||record.purge_pending_at)throw new AppError("NOT_FOUND",404,"Không tìm thấy hồ sơ ứng tuyển.");
  const job=await dbResult(client.from("jobs").select("owner_user_id").eq("id",record.job_id).single());
  if(actor!==record.candidate_user_id&&actor!==job.owner_user_id)throw new AppError("NOT_FOUND",404,"Không tìm thấy hồ sơ ứng tuyển.");
  return {record,audience:actor===record.candidate_user_id?"CANDIDATE" as const:"HR" as const};
}
export async function getApplicationTask(actor:string,id:string){
  const data=await dbResult(createAdminClient().rpc("lc_application_task",{p_actor:actor,p_application:jobId(id)}));
  return data?taskDTOSchema.parse(data):null;
}
export async function getEssayTask(actor:string,id:string){
  const data=await dbResult(createAdminClient().rpc("lc_essay_task",{p_actor:actor,p_application:jobId(id)}));return data?taskDTOSchema.parse(data):null;
}
export async function getApplication(actor:string,id:string,requiredAudience?:"CANDIDATE"|"HR"){
  const {record,audience}=await getApplicationRecord(actor,id);
  if(requiredAudience&&requiredAudience!==audience)throw new AppError("NOT_FOUND",404,"Không tìm thấy hồ sơ ứng tuyển.");
  const snapshot=z.object({jd:z.object({title:z.string()}),scoring_rubric:ScoringRubricSchema,interview_access_policy:z.enum(["CV_THRESHOLD","ALWAYS"]),interview_questions:InterviewQuestionsSchema}).parse(record.job_snapshot_json);
  const report=record.cv_evaluation_json?cvReportSchema.parse(record.cv_evaluation_json):null;
  const profile=await dbResult(createAdminClient().from("users").select("display_name").eq("id",record.candidate_user_id).single());
  const interview=record.interview_evaluation_json?interviewReportSchema.parse(record.interview_evaluation_json):null;
  const quiz=record.quiz_result_json?quizResultSchema.parse(record.quiz_result_json):null;
  const questions=snapshot.interview_questions;
  const answers=audience==="HR"&&record.interview_submitted_at?normalizeCandidateAnswers(record.candidate_answers_json,questions).answers:null;
  const review=answers?{
    quiz:questions.quiz.map(q=>{const result=quiz?.questions.find(r=>r.question_id===q.id);const selected=answers.quiz.find(a=>a.question_id===q.id)?.selected_answer;return {id:q.id,prompt:q.prompt,selected:q.options.find(o=>o.id===selected)?.text??null,expected:q.options.find(o=>o.id===q.correct_answer)!.text,earned_points:result?.earned_points??0,max_points:q.max_points};}),
    essay:questions.essay.map(q=>{const result=interview?.essay.questions.find(r=>r.question_id===q.id);return {id:q.id,prompt:q.prompt,answer:answers.essay.find(a=>a.question_id===q.id)?.text??"",earned_points:result?.earned_points??null,max_points:q.max_points,feedback:result?.feedback??null,
      criteria:q.rubric.map(c=>{const score=result?.criteria.find(r=>r.criterion_id===c.id);return {id:c.id,description:c.description,guidance:c.scoring_guidance,score:score?.score??null,max_points:c.max_points,evidence:score?.evidence??[],feedback:score?.feedback??null};}),
    };}),
  }:null;
  return applicationDetailSchema.parse({id:record.id,job_id:record.job_id,job_title:snapshot.jd.title,candidate_name:profile.display_name,status:record.status,
    version:record.version,hr_decision_message:record.hr_decision_message,hr_decided_at:record.hr_decided_at,created_at:record.created_at,cv_score:record.cv_score,audience,cv_source:record.cv_source,cv_text:record.cv_text,has_file:!!record.cv_storage_path,
    pass_threshold:snapshot.scoring_rubric.pass_threshold,interview_access_policy:snapshot.interview_access_policy,
    eligibility:interviewEligibility(record.cv_score,snapshot.scoring_rubric.pass_threshold,snapshot.interview_access_policy),summary:report?.summary??null,
    report:audience==="HR"?report:null,criterion_labels:audience==="HR"?Object.fromEntries(snapshot.scoring_rubric.criteria.map(c=>[c.id,c.label])):null,
    task:await getApplicationTask(actor,id),
    duration_minutes:questions.duration_minutes,interview_started_at:record.interview_started_at,interview_deadline_at:record.interview_deadline_at,interview_submitted_at:record.interview_submitted_at,
    submission_reason:record.submission_reason,interview_score:record.interview_score,quiz_score:quiz?.score??null,essay_score:interview?.essay.score??null,interview_summary:interview?.essay.summary??null,
    interview_review:review,interview_task:record.interview_submitted_at?await getEssayTask(actor,id):null,
  });
}
export async function listApplications(actor:string,value:unknown,job:string|null=null){
  const filters=parseInput(applicationFiltersSchema,value);const after=filters.cursor?decodeCursor(filters.cursor):null;
  const rows=z.array(applicationCardSchema).parse(await dbResult(createAdminClient().rpc("lc_list_applications",{
    p_actor:actor,p_job:job?jobId(job):null,p_status:filters.status??null,p_before_time:after?.time??null,p_before_id:after?.id??null,p_limit:filters.limit,
  })));
  const items=rows.slice(0,filters.limit);const last=items.at(-1);
  return {items,next_cursor:rows.length>filters.limit&&last?encodeCursor(last.created_at,last.id):null};
}
export async function retryCVTask(actor:string,id:string,key:string){
  const ai=getAISettings();
  return z.object({task_id:z.uuid(),application_id:z.uuid()}).parse(await dbResult(createAdminClient().rpc("lc_retry_cv",{
    p_actor:actor,p_task:jobId(id),p_key:key,p_hash:requestHash({task_id:id}),p_model:ai.model,p_prompt_version:PROMPT_VERSION,
  })));
}
export async function retryEssayTask(actor:string,id:string,key:string){
  return z.object({task_id:z.uuid(),application_id:z.uuid()}).parse(await dbResult(createAdminClient().rpc("lc_retry_essay",{
    p_actor:actor,p_task:jobId(id),p_key:key,p_hash:requestHash({task_id:id}),p_model:getAISettings().model,p_prompt_version:PROMPT_VERSION,
  })));
}
