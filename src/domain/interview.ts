import { z } from "zod";
import { candidateAnswersSchema } from "./answer-validation.ts";
export const publicQuestionsSchema=z.strictObject({
  quiz:z.array(z.strictObject({id:z.string(),prompt:z.string(),options:z.array(z.strictObject({id:z.string(),text:z.string()}))})),
  essay:z.array(z.strictObject({id:z.string(),prompt:z.string()})),
});
export const interviewDTOSchema=z.strictObject({
  id:z.uuid(),job_title:z.string(),state:z.enum(["NOT_STARTED","IN_PROGRESS","SUBMITTED","EVALUATED"]),eligible:z.boolean(),duration_minutes:z.number().int().min(5).max(120),
  started_at:z.string().nullable(),deadline_at:z.string().nullable(),server_now:z.string(),answer_version:z.number().int().min(0),saved_at:z.string().nullable(),
  questions:publicQuestionsSchema.nullable(),answers:candidateAnswersSchema.nullable(),submitted_at:z.string().nullable(),submission_reason:z.enum(["MANUAL","TIMEOUT"]).nullable(),
});
export type InterviewDTO=z.infer<typeof interviewDTOSchema>;
export const savedAnswersDTOSchema=z.strictObject({answer_version:z.number().int().min(0),saved_at:z.string(),deadline_at:z.string(),server_now:z.string()});
export type SavedAnswersDTO=z.infer<typeof savedAnswersDTOSchema>;
const score=z.number().min(0).max(100),points=z.number().int().min(0).max(3000),maxPoints=z.number().int().min(1).max(3000);
export const quizResultSchema=z.strictObject({earned_points:points,max_points:maxPoints,score,questions:z.array(z.strictObject({
  question_id:z.string(),selected_answer:z.string().nullable(),is_correct:z.boolean(),earned_points:points,max_points:maxPoints,
})).min(1).max(30)});
export const essayResultSchema=z.strictObject({earned_points:points,max_points:maxPoints,score,summary:z.string().min(1).max(2000),questions:z.array(z.strictObject({
  question_id:z.string(),earned_points:points,max_points:maxPoints,feedback:z.string().min(1).max(2000),criteria:z.array(z.strictObject({
    criterion_id:z.string(),score:z.number().int().min(0).max(100),max_points:z.number().int().min(1).max(100),evidence:z.array(z.string().min(1).max(2000)).max(10),feedback:z.string().min(1).max(2000),
  })).min(1).max(10),
})).min(1).max(10)});
export const interviewReportSchema=z.strictObject({schema_version:z.literal(1),quiz:quizResultSchema,essay:essayResultSchema,quiz_weight:z.literal(40),essay_weight:z.literal(60),total_score:score});
export const interviewReviewSchema=z.object({
  quiz:z.array(z.object({id:z.string(),prompt:z.string(),selected:z.string().nullable(),expected:z.string(),earned_points:points,max_points:maxPoints})),
  essay:z.array(z.object({id:z.string(),prompt:z.string(),answer:z.string(),earned_points:points.nullable(),max_points:maxPoints,feedback:z.string().nullable(),
    criteria:z.array(z.object({id:z.string(),description:z.string(),guidance:z.string(),score:points.nullable(),max_points:maxPoints,evidence:z.array(z.string()),feedback:z.string().nullable()})),
  })),
});
