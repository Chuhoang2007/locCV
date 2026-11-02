import "server-only";
import { z } from "zod";
import type { CandidateQuestionDTO, PublicJobDTO } from "@/domain/dto";

const jobPublic = z.object({
  id: z.uuid(), title: z.string(), location: z.string().nullable(), skills: z.array(z.string()),
  salary_min: z.number().nullable(), salary_max: z.number().nullable(), published_at: z.string().nullable(),
});
export function toPublicJobDTO(value: unknown): PublicJobDTO { return jobPublic.parse(value); }

const publicQuestions = z.object({
  quiz: z.array(z.object({ id: z.string(), prompt: z.string(), options: z.array(z.object({ id: z.string(), text: z.string() })) })),
  essay: z.array(z.object({ id: z.string(), prompt: z.string() })),
});
// Zod object giữ đúng allowlist, không spread snapshot/correct_answer/rubric.
export function toCandidateQuestionDTO(value: unknown): CandidateQuestionDTO { return publicQuestions.parse(value); }
