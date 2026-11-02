import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAISettings, isAccountConfigured } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { PROMPT_VERSION } from "@/lib/ai-client";
import { ownedJobSchema, publicJobCardSchema, publicJobDetailSchema, hrJobCardSchema, type JobEditorData } from "@/domain/job-dto";
import { createJobSchema, generateJobSchema, saveJobSchema, publicSearchSchema, hrSearchSchema, decodeCursor, encodeCursor } from "@/domain/jobs";
import { publishableDraftSchema } from "@/domain/stored-json-schemas";
import { taskDTOSchema } from "@/domain/task";
import { requestHash } from "@/server/idempotency";
import { dbResult } from "@/server/rpc";
import type { Json } from "@/lib/db.types";
import { validationFeedback } from "@/domain/validation";

export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("INVALID_INPUT",400,"Thông tin chưa hợp lệ. Hãy kiểm tra các trường và thử lại.",validationFeedback(result.error.issues));
  return result.data;
}
export function jobId(value: string) { return parseInput(z.uuid(),value); }
const ownColumns = "id,status,version,raw_hr_prompt,jd_json,scoring_rubric_json,interview_questions_json,interview_access_policy,created_at,updated_at,published_at,closed_at";
export async function getOwnedJob(id: string, actor: string): Promise<JobEditorData> {
  const client = createAdminClient();
  const data = await dbResult(client.from("jobs").select(ownColumns).eq("id",jobId(id)).eq("owner_user_id",actor).maybeSingle());
  if (!data) throw new AppError("NOT_FOUND",404,"Không tìm thấy tin tuyển dụng.");
  const task = await dbResult(client.from("ai_tasks").select("id,job_id,state,network_attempts,available_at,error_code,updated_at").eq("job_id",id).eq("kind","GENERATE_JOB").order("created_at",{ascending:false}).order("id",{ascending:false}).limit(1).maybeSingle());
  return { job: ownedJobSchema.parse(data), task: task ? taskDTOSchema.parse({
    id:task.id,job_id:task.job_id,state:task.state,attempt:task.network_attempts,max_attempts:3,
    next_retry_at:task.state === "RETRY_WAIT" ? task.available_at : null,error_code:task.error_code,
    can_retry:task.state === "FAILED" && data.status === "DRAFT",updated_at:task.updated_at,
  }) : null };
}
export async function createJob(actor: string, value: unknown, key: string) {
  const input = parseInput(createJobSchema,value);
  const ai = input.generate ? getAISettings() : {model:"not-used"};
  return parseInput(z.object({job_id:z.uuid(),task_id:z.uuid().nullable()}),await dbResult(createAdminClient().rpc("lc_create_job",{
    p_actor:actor,p_prompt:input.raw_hr_prompt,p_generate:input.generate,p_key:key,p_hash:requestHash(input),p_model:ai.model,p_prompt_version:PROMPT_VERSION,
  })));
}
export async function generateJob(actor: string, id: string, value: unknown, key: string, retryTask: string | null = null) {
  const input = parseInput(generateJobSchema,value); const ai = getAISettings();
  return parseInput(z.object({task_id:z.uuid(),job_id:z.uuid()}),await dbResult(createAdminClient().rpc("lc_generate_job",{
    p_actor:actor,p_job:jobId(id),p_version:input.expected_version,p_prompt:input.raw_hr_prompt,p_key:key,p_hash:requestHash(retryTask ? {retry_task:retryTask} : input),
    p_model:ai.model,p_prompt_version:PROMPT_VERSION,p_retry_task:retryTask,
  })));
}
export async function saveJob(actor: string, id: string, value: unknown) {
  const input = parseInput(saveJobSchema,value);
  const data = await dbResult(createAdminClient().rpc("lc_save_job",{p_actor:actor,p_job:jobId(id),p_version:input.expected_version,p_draft:input.draft as Json}));
  return ownedJobSchema.parse(data);
}
export async function publishJob(actor: string, id: string, version: number) {
  const {job} = await getOwnedJob(id,actor);
  if (job.status === "DRAFT") {
    const parsed = publishableDraftSchema.safeParse({jd:job.jd_json,scoring_rubric:job.scoring_rubric_json,interview_questions:job.interview_questions_json,interview_access_policy:job.interview_access_policy});
    if (!parsed.success) throw new AppError("INVALID_DRAFT",422,"Hãy sửa các trường được đánh dấu trước khi đăng tin.",validationFeedback(parsed.error.issues));
  }
  return ownedJobSchema.parse(await dbResult(createAdminClient().rpc("lc_publish_job",{p_actor:actor,p_job:jobId(id),p_version:version})));
}
export async function closeJob(actor: string, id: string, version: number) {
  return ownedJobSchema.parse(await dbResult(createAdminClient().rpc("lc_close_job",{p_actor:actor,p_job:jobId(id),p_version:version})));
}
function cursor(value: string | undefined) {
  const result = decodeCursor(value);
  if (result === undefined) throw new AppError("INVALID_CURSOR",400,"Liên kết phân trang chưa hợp lệ. Hãy bắt đầu lại từ danh sách.");
  return result;
}
export async function listPublicJobs(value: unknown) {
  const filters = parseInput(publicSearchSchema,value); const after = cursor(filters.cursor);
  if (!isAccountConfigured()) return {items:[],next_cursor:null,configured:false};
  const raw = await dbResult(createAdminClient().rpc("lc_search_jobs",{p_q:filters.q,p_skill:filters.skill,p_min:filters.salary_min??null,p_max:filters.salary_max??null,p_before_time:after?.time??null,p_before_id:after?.id??null,p_limit:filters.limit}));
  const rows = z.array(publicJobCardSchema).parse(raw); const items = rows.slice(0,filters.limit); const last = items.at(-1);
  return {items,next_cursor:rows.length>filters.limit && last ? encodeCursor(last.published_at,last.id) : null,configured:true};
}
export async function getPublicJob(id: string) {
  if (!isAccountConfigured()) return null;
  const data = await dbResult(createAdminClient().rpc("lc_public_job",{p_job:jobId(id)}));
  return data ? publicJobDetailSchema.parse(data) : null;
}
export async function listHRJobs(actor: string, value: unknown) {
  const filters = parseInput(hrSearchSchema,value); const after = cursor(filters.cursor);
  const raw = await dbResult(createAdminClient().rpc("lc_list_hr_jobs",{p_actor:actor,p_status:filters.status??null,p_before_time:after?.time??null,p_before_id:after?.id??null,p_limit:filters.limit}));
  const rows = z.array(hrJobCardSchema).parse(raw); const items = rows.slice(0,filters.limit); const last=items.at(-1);
  return {items,next_cursor:rows.length>filters.limit && last ? encodeCursor(last.created_at,last.id) : null};
}
