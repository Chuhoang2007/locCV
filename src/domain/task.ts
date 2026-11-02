import { z } from "zod";
export const taskStateSchema = z.enum(["QUEUED", "RUNNING", "RETRY_WAIT", "SUCCEEDED", "FAILED"]);
export const taskDTOSchema = z.object({
  id: z.uuid(), job_id: z.uuid(), application_id:z.uuid().optional(),kind:z.enum(["GENERATE_JOB","EVALUATE_CV","EVALUATE_ESSAY"]).optional(), state: taskStateSchema, attempt: z.number().int().min(0).max(3),
  max_attempts: z.literal(3), next_retry_at: z.string().nullable(), error_code: z.string().nullable(),
  can_retry: z.boolean(), updated_at: z.string(),
});
export type TaskDTO = z.infer<typeof taskDTOSchema>;
export const isTaskActive = (state: TaskDTO["state"]) => ["QUEUED","RUNNING","RETRY_WAIT"].includes(state);
