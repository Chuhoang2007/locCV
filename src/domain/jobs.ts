import { z } from "zod";

const short = z.string().max(4000);
const id = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const points = z.number().int().min(1).max(100);
export const jobStatusSchema = z.enum(["DRAFT", "PUBLISHED", "CLOSED"]);
export const accessPolicySchema = z.enum(["CV_THRESHOLD", "ALWAYS"]);

// Nháp cho phép nội dung chưa đủ và tổng điểm chưa đúng. Publish dùng schema strict ở server.
export const editableDraftSchema = z.strictObject({
  jd: z.strictObject({
    title: z.string().max(180), summary: short,
    responsibilities: z.array(short).max(20), requirements: z.array(short).max(20),
    benefits: z.array(short).max(20), skills: z.array(z.string().max(100)).max(30),
    location: z.string().max(180), salary_min: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
    salary_max: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
    salary_currency: z.literal("VND"), salary_period: z.literal("MONTH"),
  }),
  scoring_rubric: z.strictObject({ schema_version: z.literal(1), pass_threshold: z.number().int().min(0).max(100),
    criteria: z.array(z.strictObject({ id, label: z.string().max(200), max_points: points, scoring_guidance: short })).max(20) }),
  interview_questions: z.strictObject({ schema_version: z.literal(1), duration_minutes: z.number().int().min(5).max(120),
    quiz_weight: z.literal(40), essay_weight: z.literal(60),
    quiz: z.array(z.strictObject({ id, prompt: short, options: z.array(z.strictObject({ id, text: short })).min(2).max(6), correct_answer: id, max_points: points })).max(30),
    essay: z.array(z.strictObject({ id, prompt: short, max_points: points, rubric: z.array(z.strictObject({ id, description: short, max_points: points, scoring_guidance: short })).max(10) })).max(10),
  }),
  interview_access_policy: accessPolicySchema,
});
export type EditableDraft = z.infer<typeof editableDraftSchema>;
export const versionSchema = z.number().int().positive();
export const createJobSchema = z.strictObject({ raw_hr_prompt: z.string().trim().max(8000), generate: z.boolean() })
  .refine(v => !v.generate || v.raw_hr_prompt.length >= 10, { message: "Mô tả cần ít nhất 10 ký tự để tạo bằng AI.", path: ["raw_hr_prompt"] });
export const generateJobSchema = z.strictObject({ expected_version: versionSchema, raw_hr_prompt: z.string().trim().min(10).max(8000) });
export const saveJobSchema = z.strictObject({ expected_version: versionSchema, draft: editableDraftSchema });
export const actionJobSchema = z.strictObject({ expected_version: versionSchema });

export const cursorSchema = z.object({ time: z.iso.datetime({ offset: true }), id: z.uuid() });
export function encodeCursor(time: string, id: string) { return Buffer.from(JSON.stringify({ time, id })).toString("base64url"); }
export function decodeCursor(value: string | undefined) {
  if (!value) return null;
  try { if (value.length > 300) return undefined; return cursorSchema.parse(JSON.parse(Buffer.from(value,"base64url").toString())); }
  catch { return undefined; }
}
const salary = z.preprocess(v => v === "" || v == null ? undefined : v, z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional());
export const publicSearchSchema = z.strictObject({
  q: z.string().trim().max(160).default(""), skill: z.string().trim().max(100).default(""),
  salary_min: salary, salary_max: salary, cursor: z.string().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).refine(v => v.salary_min == null || v.salary_max == null || v.salary_min <= v.salary_max, { message: "Lương tối thiểu không được vượt lương tối đa.", path: ["salary_max"] });
export const hrSearchSchema = z.strictObject({ status: jobStatusSchema.optional(), cursor: z.string().max(300).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });

export function emptyDraft(): EditableDraft {
  return { jd: { title: "", summary: "", responsibilities: [""], requirements: [""], benefits: [""], skills: [], location: "", salary_min: null, salary_max: null, salary_currency: "VND", salary_period: "MONTH" },
    scoring_rubric: { schema_version: 1, pass_threshold: 60, criteria: [{ id: "criterion_1", label: "", max_points: 100, scoring_guidance: "" }] },
    interview_questions: { schema_version: 1, duration_minutes: 30, quiz_weight: 40, essay_weight: 60,
      quiz: [{ id: "q_1", prompt: "", options: [{ id: "a", text: "" }, { id: "b", text: "" }], correct_answer: "a", max_points: 10 }],
      essay: [{ id: "e_1", prompt: "", max_points: 10, rubric: [{ id: "reasoning", description: "", max_points: 10, scoring_guidance: "" }] }] },
    interview_access_policy: "CV_THRESHOLD" };
}
