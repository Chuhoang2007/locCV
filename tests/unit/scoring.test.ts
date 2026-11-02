import { afterEach,beforeEach,describe,it,expect,vi } from "vitest";
import fixture from "../fixtures/generated-job.json";
import { gradeQuiz,buildInterviewEvaluation } from "@/domain/scoring";
import { evaluateInterviewAnswers } from "@/lib/ai-client";
const questions=fixture.interview_questions;
const answer="Tôi kiểm tra schema trước xử lý. Tôi bắt lỗi và che dữ liệu riêng.";
const answers={quiz:questions.quiz.map(q=>({question_id:q.id,selected_answer:"a"})),essay:[{question_id:"e_api",text:answer}]};
const raw=()=>({questions:[{question_id:"e_api",criteria:[{criterion_id:"validation",score:6,evidence:["kiểm tra schema"],feedback:"Kiểm tra runtime."},{criterion_id:"errors",score:2,evidence:["bắt lỗi"],feedback:"Có xử lý lỗi."}],feedback:"Có bằng chứng trong câu trả lời."}],summary:"Tóm tắt dựa trên bằng chứng."});
function envelope(value:unknown){return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:JSON.stringify(value)}}]}));}
beforeEach(()=>{vi.stubEnv("NINE_ROUTER_BASE_URL","https://fixture.nine.test/v1");vi.stubEnv("NINE_ROUTER_API_KEY","fixture-only");vi.stubEnv("NINE_ROUTER_MODEL","fixture");});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe("Quiz local and combined scoring",()=>{
  it("grades correct, incorrect, null and missing answers without calling AI",()=>{
    const network=vi.fn();vi.stubGlobal("fetch",network);
    expect(gradeQuiz(answers,questions).score).toBe(100);
    expect(gradeQuiz({...answers,quiz:questions.quiz.map(q=>({question_id:q.id,selected_answer:"b"}))},questions).score).toBe(0);
    expect(gradeQuiz({quiz:[{question_id:questions.quiz[0].id,selected_answer:"a"}],essay:[]},questions).score).toBe(50);
    const blank=gradeQuiz({quiz:[],essay:[]},questions);expect(blank.score).toBe(0);expect(blank.questions.every(q=>q.selected_answer===null)).toBe(true);expect(network).not.toHaveBeenCalled();
  });
  it("only sends essay and its rubric; quiz 100 and essay 80 combine to 88",async()=>{
    const provider=vi.fn(async(_url:unknown,init?:RequestInit)=>{const body=JSON.parse(String(init?.body));const payload=JSON.parse(body.messages[1].content);expect(Object.keys(payload)).toEqual(["candidate_answers","question_rubrics"]);expect(JSON.stringify(payload)).not.toMatch(/correct_answer|q_typescript|cv_text/);return envelope(raw());});vi.stubGlobal("fetch",provider);
    const essay=await evaluateInterviewAnswers(answers,questions);expect(essay.score).toBe(80);expect(buildInterviewEvaluation(gradeQuiz(answers,questions),essay,{quiz_weight:40,essay_weight:60}).total_score).toBe(88);
  });
  it("rejects forged IDs, duplicate criteria, invented quotes, excess points and positive blank answers",async()=>{
    const cases=[(value:ReturnType<typeof raw>)=>{value.questions[0].question_id="fake";},(value:ReturnType<typeof raw>)=>{value.questions[0].criteria[1].criterion_id="validation";},(value:ReturnType<typeof raw>)=>{value.questions[0].criteria[0].evidence=["not in this answer"];},(value:ReturnType<typeof raw>)=>{value.questions[0].criteria[0].score=7;}];
    for(const mutate of cases){const value=raw();mutate(value);vi.stubGlobal("fetch",vi.fn(async()=>envelope(value)));await expect(evaluateInterviewAnswers(answers,questions)).rejects.toMatchObject({code:"INVALID_OUTPUT"});}
    vi.stubGlobal("fetch",vi.fn(async()=>envelope(raw())));await expect(evaluateInterviewAnswers({quiz:[],essay:[]},questions)).rejects.toMatchObject({code:"INVALID_OUTPUT"});
  });
  it("accepts zero for missing essay and rejects non-40/60 weights",async()=>{
    const value=raw();for(const c of value.questions[0].criteria){c.score=0;c.evidence=[];}
    vi.stubGlobal("fetch",vi.fn(async()=>envelope(value)));const essay=await evaluateInterviewAnswers({quiz:[],essay:[]},questions);expect(essay.score).toBe(0);
    expect(()=>buildInterviewEvaluation(gradeQuiz(answers,questions),essay,{quiz_weight:50,essay_weight:50} as unknown as {quiz_weight:40;essay_weight:60})).toThrow();
  });
});
