import { describe,it,expect } from "vitest";
import fixture from "../fixtures/generated-job.json";
import { candidateAnswersSchema,saveAnswersSchema,submitInterviewSchema,validateAnswerIDs } from "@/domain/answer-validation";
import { publicQuestionsSchema } from "@/domain/interview";
describe("Untrusted answer input",()=>{
  it("accepts missing/null answers and preserves essay whitespace",()=>{
    expect(validateAnswerIDs({quiz:[],essay:[]},fixture.interview_questions)).toEqual({quiz:[],essay:[]});
    expect(candidateAnswersSchema.parse({quiz:[{question_id:"q_typescript",selected_answer:null}],essay:[{question_id:"e_api",text:"  answer  "}]}).essay[0].text).toBe("  answer  ");
  });
  it("rejects unknown IDs, duplicated answers, fake options and extra score/deadline fields",()=>{
    for(const value of [{quiz:[{question_id:"fake",selected_answer:null}],essay:[]},{quiz:[{question_id:"q_test",selected_answer:"fake"}],essay:[]},{quiz:[{question_id:"q_test",selected_answer:"a"},{question_id:"q_test",selected_answer:"b"}],essay:[]},{quiz:[],essay:[{question_id:"fake",text:"text"}]}])expect(()=>validateAnswerIDs(value,fixture.interview_questions)).toThrow();
    expect(saveAnswersSchema.safeParse({answer_version:0,answers:{quiz:[],essay:[]},score:100}).success).toBe(false);
    expect(submitInterviewSchema.safeParse({answer_version:0,answers:{quiz:[],essay:[]}}).success).toBe(false);
    expect(candidateAnswersSchema.safeParse({quiz:[],essay:[{question_id:"e_api",text:"x".repeat(5001)}]}).success).toBe(false);
  });
  it("the exam DTO refuses private question properties",()=>{
    expect(publicQuestionsSchema.safeParse(fixture.interview_questions).success).toBe(false);
    expect(publicQuestionsSchema.safeParse({quiz:[fixture.interview_questions.quiz[0]],essay:[]}).success).toBe(false);
  });
});
