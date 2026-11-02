import { z } from "zod";
const id=z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
export const candidateAnswersSchema=z.strictObject({
  quiz:z.array(z.strictObject({question_id:id,selected_answer:id.nullable()})).max(30),
  essay:z.array(z.strictObject({question_id:id,text:z.string().max(5000)})).max(10),
});
export type CandidateAnswers=z.infer<typeof candidateAnswersSchema>;
export type AnswerQuestions={quiz:{id:string;options:{id:string}[]}[];essay:{id:string}[]};
export function validateAnswerIDs(value:unknown,questions:AnswerQuestions):CandidateAnswers{
  const answers=candidateAnswersSchema.parse(value);
  if(new Set(answers.quiz.map(a=>a.question_id)).size!==answers.quiz.length||new Set(answers.essay.map(a=>a.question_id)).size!==answers.essay.length)throw new Error("INVALID_ANSWERS");
  for(const a of answers.quiz){const question=questions.quiz.find(q=>q.id===a.question_id);if(!question||(a.selected_answer!==null&&!question.options.some(o=>o.id===a.selected_answer)))throw new Error("INVALID_ANSWERS");}
  if(answers.essay.some(a=>!questions.essay.some(q=>q.id===a.question_id)))throw new Error("INVALID_ANSWERS");
  return answers;
}
export const saveAnswersSchema=z.strictObject({answer_version:z.number().int().min(0),answers:candidateAnswersSchema});
export const submitInterviewSchema=z.strictObject({answer_version:z.number().int().min(0)});
