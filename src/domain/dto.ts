import type { Profile } from "./profile";

export type ViewerDTO = { id: string; email: string; profile: Profile };
export type PublicJobDTO = {
  id: string; title: string; location: string | null; skills: string[];
  salary_min: number | null; salary_max: number | null; published_at: string | null;
};
export type CandidateQuestionDTO = {
  quiz: { id: string; prompt: string; options: { id: string; text: string }[] }[];
  essay: { id: string; prompt: string }[];
};
