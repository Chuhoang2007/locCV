import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAISettings } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { normalizeCandidateAnswers } from "@/lib/ai-client";
import type { Json } from "@/lib/db.types";
import { interviewDTOSchema,savedAnswersDTOSchema } from "@/domain/interview";
import { saveAnswersSchema,submitInterviewSchema } from "@/domain/answer-validation";
import { submitPersistedInterview,type SubmissionStore } from "../interview-submission";
import { getApplicationRecord } from "./applications";
import { jobId,parseInput } from "./jobs";
import { dbResult } from "../rpc";
export async function getInterview(actor:string,id:string){
  return interviewDTOSchema.parse(await dbResult(createAdminClient().rpc("lc_interview_dto",{p_actor:actor,p_application:jobId(id)})));
}
export async function startInterview(actor:string,id:string,value:unknown){
  parseInput(z.strictObject({}),value);
  return interviewDTOSchema.parse(await dbResult(createAdminClient().rpc("lc_start_interview",{p_actor:actor,p_application:jobId(id)})));
}
export async function saveInterviewAnswers(actor:string,id:string,value:unknown){
  const input=parseInput(saveAnswersSchema,value);const {record,audience}=await getApplicationRecord(actor,id);
  if(audience!=="CANDIDATE")throw new AppError("NOT_FOUND",404,"Không tìm thấy bài thi.");
  const snapshot=z.object({interview_questions:z.unknown()}).parse(record.job_snapshot_json);
  let normalized;
  try{normalized=normalizeCandidateAnswers(input.answers,snapshot.interview_questions).answers;}
  catch{throw new AppError("INVALID_ANSWERS",400,"Câu trả lời có ID hoặc lựa chọn không thuộc bài thi. Hãy tải bản mới nhất.");}
  return savedAnswersDTOSchema.parse(await dbResult(createAdminClient().rpc("lc_save_answers",{p_actor:actor,p_application:jobId(id),p_version:input.answer_version,p_answers:normalized})));
}
export function submissionStore():SubmissionStore{
  const client=createAdminClient();return {
    prepareSubmission:(actor,id,timeout)=>dbResult(client.rpc("lc_prepare_submission",{p_actor:actor,p_application:id,p_timeout:timeout})),
    commitSubmission:input=>dbResult(client.rpc("lc_submit_interview",{p_actor:input.actor,p_application:input.id,p_version:input.version,p_quiz:input.quiz as Json,p_model:input.model,p_prompt_version:input.promptVersion,p_timeout:input.timeout})),
  };
}
export async function submitInterview(actor:string,id:string,value:unknown){
  const input=parseInput(submitInterviewSchema,value);const current=await getInterview(actor,id);
  const expired=current.deadline_at!==null&&new Date(current.server_now)>=new Date(current.deadline_at);
  return submitPersistedInterview(submissionStore(),actor,jobId(id),getAISettings().model,false,expired?undefined:input.answer_version);
}
