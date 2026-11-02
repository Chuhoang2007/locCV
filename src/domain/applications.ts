import { z } from "zod";
import { APPLICATION_STATUSES } from "./application-state.ts";
import { taskDTOSchema } from "./task.ts";
import { interviewReviewSchema } from "./interview.ts";

export const cvTextSchema=z.string().trim().min(100,"CV cần ít nhất 100 ký tự.").max(30000,"CV chỉ được tối đa 30.000 ký tự.");
export const applySchema=z.strictObject({
  cv_source:z.enum(["TEXT","PDF","DOCX"]),upload_id:z.uuid().nullable(),cv_text:cvTextSchema,
  ai_processing_acknowledged:z.literal(true,{error:"Bạn cần xác nhận thông báo xử lý CV bằng AI."}),
}).refine(value=>(value.cv_source==="TEXT")===(value.upload_id===null),{message:"Hãy chọn lại nguồn CV.",path:["upload_id"]});
export const applicationFiltersSchema=z.object({
  status:z.preprocess(value=>value===""?undefined:value,z.enum(APPLICATION_STATUSES).optional()),cursor:z.string().max(400).optional(),limit:z.coerce.number().int().min(1).max(50).default(20),
});
export const applicationCardSchema=z.object({id:z.uuid(),job_id:z.uuid(),job_title:z.string(),candidate_name:z.string(),
  status:z.enum(APPLICATION_STATUSES),cv_score:z.number().int().min(0).max(100).nullable(),interview_score:z.number().min(0).max(100).nullable().default(null),created_at:z.string()});
export type ApplicationCard=z.infer<typeof applicationCardSchema>;
export const cvReportSchema=z.strictObject({schema_version:z.literal(1),
  criteria:z.array(z.strictObject({criterion_id:z.string(),score:z.number().int().min(0).max(100),max_points:z.number().int().min(1).max(100),
    evidence:z.array(z.string().min(1).max(2000)).max(10),missing_evidence:z.array(z.string().min(1).max(2000)).max(10),feedback:z.string().min(1).max(2000)})).min(1).max(20),
  total_score:z.number().int().min(0).max(100),pass_threshold:z.number().int().min(0).max(100),passed:z.boolean(),summary:z.string().min(1).max(2000)});
export type CvReport=z.infer<typeof cvReportSchema>;
export function interviewEligibility(score:number|null,threshold:number,policy:"CV_THRESHOLD"|"ALWAYS"){
  if(score===null)return {eligible:false,reason:"AWAITING_CV" as const};
  return score>=threshold||policy==="ALWAYS"?{eligible:true,reason:"ELIGIBLE" as const}:{eligible:false,reason:"CV_THRESHOLD" as const};
}
export const applicationDetailSchema=applicationCardSchema.extend({
  version:z.number().int().positive(),hr_decision_message:z.string().nullable(),hr_decided_at:z.string().nullable(),
  audience:z.enum(["CANDIDATE","HR"]),cv_source:z.enum(["TEXT","PDF","DOCX"]),cv_text:z.string(),has_file:z.boolean(),
  pass_threshold:z.number(),interview_access_policy:z.enum(["CV_THRESHOLD","ALWAYS"]),
  eligibility:z.object({eligible:z.boolean(),reason:z.enum(["AWAITING_CV","ELIGIBLE","CV_THRESHOLD"])}),
  summary:z.string().nullable(),report:cvReportSchema.nullable(),criterion_labels:z.record(z.string(),z.string()).nullable(),task:taskDTOSchema.nullable(),
  duration_minutes:z.number().int().min(5).max(120),interview_started_at:z.string().nullable(),interview_deadline_at:z.string().nullable(),interview_submitted_at:z.string().nullable(),
  submission_reason:z.enum(["MANUAL","TIMEOUT"]).nullable(),quiz_score:z.number().min(0).max(100).nullable(),essay_score:z.number().min(0).max(100).nullable(),
  interview_summary:z.string().nullable(),interview_review:interviewReviewSchema.nullable(),interview_task:taskDTOSchema.nullable(),
});
export type ApplicationDetail=z.infer<typeof applicationDetailSchema>;
export const applicationStatusLabel:Record<ApplicationCard["status"],string>={CV_SUBMITTED:"Đang đánh giá CV",CV_PASSED:"Đạt ngưỡng CV",CV_FAILED:"Chưa đạt ngưỡng CV",
  INTERVIEW_IN_PROGRESS:"Đang làm bài",EVALUATED:"Chờ HR phản hồi",HR_APPROVED:"Được chấp thuận",HR_REJECTED:"Không được chọn"};
