import "server-only";
import { z } from "zod";
import { candidateAnswersSchema } from "../domain/answer-validation.ts";

const id = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const text = z.string().trim().min(1).max(4000);
const note = z.string().trim().min(1).max(2000);
const points = z.number().int().min(1).max(100);
const score = z.number().int().min(0).max(100);
const evidence = z.array(note).max(10);
const unique = (items: string[]) => new Set(items).size === items.length;

export const ScoringRubricSchema = z.strictObject({
  schema_version: z.literal(1),
  pass_threshold: z.number().int().min(0).max(100),
  criteria: z.array(z.strictObject({
    id, label: z.string().trim().min(1).max(200),
    max_points: points, scoring_guidance: text,
  })).min(1).max(20),
}).superRefine((value, ctx) => {
  if (!unique(value.criteria.map(c => c.id))) {
    ctx.addIssue({ code: "custom", path:["criteria"], message: "Có tiêu chí bị lặp. Hãy xóa tiêu chí trùng." });
  }
  if (value.criteria.reduce((sum, c) => sum + c.max_points, 0) !== 100) {
    ctx.addIssue({ code: "custom", path:value.criteria.length?["criteria",0,"max_points"]:["criteria"], message: "Tổng điểm các tiêu chí CV phải bằng 100." });
  }
});

export const QuizQuestionSchema = z.strictObject({
  id, prompt: text,
  options: z.array(z.strictObject({ id, text })).min(2).max(6),
  correct_answer: id, max_points: points,
});
export const EssayQuestionSchema = z.strictObject({
  id, prompt: text, max_points: points,
  rubric: z.array(z.strictObject({
    id, description: text, max_points: points, scoring_guidance: text,
  })).min(1).max(10),
});

export const InterviewQuestionsSchema = z.strictObject({
  schema_version: z.literal(1),
  duration_minutes: z.number().int().min(5).max(120),
  quiz_weight: z.literal(40), essay_weight: z.literal(60),
  quiz: z.array(QuizQuestionSchema).min(1).max(30),
  essay: z.array(EssayQuestionSchema).min(1).max(10),
}).superRefine((value, ctx) => {
  const issue = (message: string,path:(string|number)[]) => ctx.addIssue({ code: "custom", message,path });
  if (!unique([...value.quiz, ...value.essay].map(q => q.id))) issue("Có câu hỏi bị lặp. Hãy xóa câu hỏi trùng.",["quiz",0,"prompt"]);
  for (const [i,q] of value.quiz.entries()) {
    if (!unique(q.options.map(o => o.id))) issue("Các lựa chọn bị lặp. Hãy xóa và thêm lại lựa chọn trùng.",["quiz",i,"options",0,"text"]);
    if (!q.options.some(o => o.id === q.correct_answer)) issue("Hãy chọn một đáp án trong các lựa chọn của câu hỏi.",["quiz",i,"correct_answer"]);
  }
  for (const [i,q] of value.essay.entries()) {
    if (!unique(q.rubric.map(c => c.id))) issue("Có tiêu chí tự luận bị lặp. Hãy xóa tiêu chí trùng.",["essay",i,"rubric",0,"description"]);
    if (q.rubric.reduce((sum, c) => sum + c.max_points, 0) !== q.max_points) {
      issue("Tổng điểm các tiêu chí phải bằng điểm tối đa của câu tự luận.",["essay",i,"max_points"]);
    }
  }
});

export const JobDescriptionSchema = z.strictObject({
  title: z.string().trim().min(1).max(180), summary: text,
  responsibilities: z.array(text).min(1).max(20),
  requirements: z.array(text).min(1).max(20),
  benefits: z.array(text).min(1).max(20),
  skills: z.array(z.string().trim().min(1).max(100)).min(1).max(30),
  location: z.string().trim().min(1).max(180),
  salary_min: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
  salary_max: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
  salary_currency: z.literal("VND"), salary_period: z.literal("MONTH"),
}).refine(v => v.salary_min === null || v.salary_max === null || v.salary_min <= v.salary_max,
  { message: "Lương tối đa phải lớn hơn hoặc bằng lương tối thiểu.",path:["salary_max"] });

export const GeneratedJobSchema = z.strictObject({
  jd: JobDescriptionSchema, scoring_rubric: ScoringRubricSchema,
  interview_questions: InterviewQuestionsSchema,
});

export const RawCvEvaluationSchema = z.strictObject({
  criteria: z.array(z.strictObject({
    criterion_id: id, score, evidence,
    missing_evidence: z.array(note).max(10), feedback: note,
  })).min(1).max(20),
  summary: note,
});

export const RawEssayEvaluationSchema = z.strictObject({
  questions: z.array(z.strictObject({
    question_id: id,
    criteria: z.array(z.strictObject({
      criterion_id: id, score, evidence, feedback: note,
    })).min(1).max(10),
    feedback: note,
  })).min(1).max(10),
  summary: note,
});

export const CandidateAnswersSchema = candidateAnswersSchema;

export type ScoringRubric = z.infer<typeof ScoringRubricSchema>;
export type InterviewQuestions = z.infer<typeof InterviewQuestionsSchema>;
export type CandidateAnswers = z.infer<typeof CandidateAnswersSchema>;
