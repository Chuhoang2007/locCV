import { z } from "zod";
import { editableDraftSchema, jobStatusSchema, accessPolicySchema } from "./jobs";
import { taskDTOSchema } from "./task";

export const ownedJobSchema = z.object({
  id: z.uuid(), status: jobStatusSchema, version: z.number().int().positive(), raw_hr_prompt: z.string().nullable(),
  jd_json: editableDraftSchema.shape.jd.nullable(), scoring_rubric_json: editableDraftSchema.shape.scoring_rubric.nullable(),
  interview_questions_json: editableDraftSchema.shape.interview_questions.nullable(), interview_access_policy: accessPolicySchema,
  created_at: z.string(), updated_at: z.string(), published_at: z.string().nullable(), closed_at: z.string().nullable(),
});
export type OwnedJob = z.infer<typeof ownedJobSchema>;
export type JobEditorData = { job: OwnedJob; task: z.infer<typeof taskDTOSchema> | null };
export const publicJobCardSchema = z.object({
  id: z.uuid(), title: z.string(), summary: z.string(), location: z.string(), skills: z.array(z.string()),
  salary_min: z.number().nullable(), salary_max: z.number().nullable(), published_at: z.string(),
});
export const publicJobDetailSchema = publicJobCardSchema.extend({
  jd: editableDraftSchema.shape.jd, duration_minutes: z.number(), pass_threshold: z.number(), interview_access_policy: accessPolicySchema,
});
export type PublicJobCard = z.infer<typeof publicJobCardSchema>;
export type PublicJobDetail = z.infer<typeof publicJobDetailSchema>;
export const hrJobCardSchema = z.object({ id: z.uuid(), title: z.string().nullable(), status: jobStatusSchema, version: z.number(), created_at: z.string(), updated_at: z.string(), published_at: z.string().nullable() });
export type HRJobCard = z.infer<typeof hrJobCardSchema>;
