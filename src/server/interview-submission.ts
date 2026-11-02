import "server-only";
import { z } from "zod";
import { gradeQuiz } from "../domain/scoring.ts";
import { AppError } from "../lib/errors.ts";
import { PROMPT_VERSION } from "../lib/ai-client.ts";
export type SubmissionCommit={actor:string|null;id:string;version:number;quiz:unknown;model:string;promptVersion:string;timeout:boolean};
export interface SubmissionStore{
  prepareSubmission(actor:string|null,id:string,timeout:boolean):Promise<unknown>;
  commitSubmission(input:SubmissionCommit):Promise<unknown>;
}
const sourceSchema=z.object({id:z.uuid(),answer_version:z.number().int(),submitted_at:z.string().nullable(),questions:z.unknown(),answers:z.unknown()});
export const submittedInterviewSchema=z.object({submitted_at:z.string(),submission_reason:z.enum(["MANUAL","TIMEOUT"]),task_id:z.uuid()});
export async function submitPersistedInterview(store:SubmissionStore,actor:string|null,id:string,model:string,timeout=false,expectedVersion?:number){
  const source=sourceSchema.parse(await store.prepareSubmission(actor,id,timeout));
  if(!source.submitted_at&&expectedVersion!==undefined&&expectedVersion!==source.answer_version)throw new AppError("ANSWER_VERSION_CONFLICT",409,"Bài làm đã được lưu ở một tab khác. Hãy tải bản mới nhất trước khi nộp.");
  const quiz=source.submitted_at?null:gradeQuiz(source.answers,source.questions);
  return submittedInterviewSchema.parse(await store.commitSubmission({actor,id,version:source.answer_version,quiz,model,promptVersion:PROMPT_VERSION,timeout}));
}
