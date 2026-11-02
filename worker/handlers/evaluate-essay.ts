import { z } from "zod";
import { AIClientError,evaluateInterviewAnswers,buildInterviewEvaluation } from "../../src/lib/ai-client.js";
import { InterviewQuestionsSchema } from "../../src/lib/ai-schemas.js";
import { quizResultSchema,interviewReportSchema } from "../../src/domain/interview.js";
import type { GenerationTask,QueueStore } from "../queue.js";
export async function evaluateEssayTask(store:QueueStore,task:GenerationTask,options:Parameters<typeof evaluateInterviewAnswers>[2],evaluate=evaluateInterviewAnswers){
  if(!task.application_id)throw new AIClientError("INVALID_INPUT");
  const app=await store.getEssay(task.application_id);
  if(app.status!=="INTERVIEW_IN_PROGRESS"||!app.interview_submitted_at||task.input_version!==app.answer_version+1)throw new AIClientError("INVALID_INPUT");
  const snapshot=z.object({interview_questions:InterviewQuestionsSchema}).parse(app.job_snapshot_json);
  const quiz=quizResultSchema.parse(app.quiz_result_json);
  const essay=await evaluate(app.candidate_answers_json,snapshot.interview_questions,options);
  return interviewReportSchema.parse(buildInterviewEvaluation(quiz,essay,snapshot.interview_questions));
}
