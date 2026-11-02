import "server-only";
// One implementation for API submission and timeout recovery; never score on the client.
export { gradeQuiz,buildInterviewEvaluation } from "../lib/ai-client.ts";
