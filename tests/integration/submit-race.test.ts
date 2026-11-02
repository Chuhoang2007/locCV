import { beforeEach,afterEach,describe,it,expect,vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "../helpers/database";
import { pgQueue,sqlRPC } from "../helpers/queue";
import { candidate,hr } from "../helpers/applications";
import { readyApplication,start,save,rawEssay } from "../helpers/interviews";
import { submitPersistedInterview } from "@/server/interview-submission";
import { runOneGeneration } from "../../worker/handlers/generate-job";
import fixture from "../fixtures/generated-job.json";
import { gradeQuiz,buildInterviewEvaluation } from "@/domain/scoring";
import { interviewAnswers } from "../helpers/interviews";
let db:PGlite;
beforeEach(async()=>{db=await createTestDatabase();});afterEach(async()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();await db.close();});
function provider(bad=false){vi.stubEnv("NINE_ROUTER_BASE_URL","https://fixture.nine.test/v1");vi.stubEnv("NINE_ROUTER_API_KEY","fixture-only");vi.stubEnv("NINE_ROUTER_MODEL","fixture");vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:bad?"{invalid":JSON.stringify(rawEssay())}}]}))));}
describe("Interview start, save and submission transactions",()=>{
  it("keeps questions private before start and returns the same deadline on repeated start",async()=>{
    const id=await readyApplication(db);const before=await sqlRPC<{questions:null;state:string}>(db,"lc_interview_dto",{p_actor:candidate,p_application:id});expect(before.questions).toBeNull();expect(before.state).toBe("NOT_STARTED");
    const first=await start(db,id),second=await start(db,id);expect(second.deadline_at).toBe(first.deadline_at);expect(second.started_at).toBe(first.started_at);
    const dto=await sqlRPC(db,"lc_interview_dto",{p_actor:candidate,p_application:id});expect(JSON.stringify(dto)).not.toMatch(/correct_answer|scoring_guidance|rubric|expected_answer/);
    await expect(sqlRPC(db,"lc_start_interview",{p_actor:hr,p_application:id})).rejects.toThrow("NOT_FOUND");
  });
  it("CAS rejects an old tab; competing submit requests create one quiz/task/receipt",async()=>{
    const id=await readyApplication(db);await start(db,id);await save(db,id);
    await expect(save(db,id,0)).rejects.toThrow("ANSWER_VERSION_CONFLICT");const queue=pgQueue(db);
    const results=await Promise.all([submitPersistedInterview(queue,candidate,id,"fixture",false,1),submitPersistedInterview(queue,candidate,id,"fixture",false,1)]);expect(results[0]).toEqual(results[1]);
    expect((await db.query("select id from public.ai_tasks where kind='EVALUATE_ESSAY'")).rows).toHaveLength(1);expect((await db.query("select id from public.messages where kind='INTERVIEW_SUBMITTED'")).rows).toHaveLength(1);
    await expect(save(db,id,1)).rejects.toThrow("INTERVIEW_CLOSED");
    const after=await sqlRPC<{questions:null;answers:null}>(db,"lc_interview_dto",{p_actor:candidate,p_application:id});expect(after.questions).toBeNull();expect(after.answers).toBeNull();
  });
  it("shared grader and essay worker compute 88, persist both components and deduplicate events",async()=>{
    const id=await readyApplication(db);await start(db,id);await save(db,id);await submitPersistedInterview(pgQueue(db),candidate,id,"fixture",false,1);provider();await runOneGeneration(pgQueue(db));
    const result=(await db.query<{status:string;cv_score:number;interview_score:string;interview_evaluation_json:{total_score:number}}>("select status,cv_score,interview_score,interview_evaluation_json from public.applications where id=$1",[id])).rows[0];expect(result.status).toBe("EVALUATED");expect(Number(result.interview_score)).toBe(88);expect(result.cv_score).toBe(60);expect(result.interview_evaluation_json.total_score).toBe(88);
    expect((await db.query("select id from public.messages where kind='APPLICATION_EVALUATED'")).rows).toHaveLength(2);
    await expect(sqlRPC(db,"lc_retry_essay",{p_actor:candidate,p_task:(await db.query<{id:string}>("select id from public.ai_tasks where kind='EVALUATE_ESSAY'")).rows[0].id,p_key:randomUUID(),p_hash:"a".repeat(64),p_model:"fixture",p_prompt_version:"recruitment-v1"})).rejects.toThrow("TASK_NOT_RETRYABLE");
  });
  it("failed essay preserves quiz and null total; bounded retry works for owning HR",async()=>{
    const id=await readyApplication(db);await start(db,id);await save(db,id);const submitted=await submitPersistedInterview(pgQueue(db),candidate,id,"fixture",false,1);provider(true);await runOneGeneration(pgQueue(db));
    const result=(await db.query<{quiz_result_json:{score:number};interview_score:null;status:string}>("select quiz_result_json,interview_score,status from public.applications where id=$1",[id])).rows[0];expect(result.quiz_result_json.score).toBe(100);expect(result.interview_score).toBeNull();expect(result.status).toBe("INTERVIEW_IN_PROGRESS");
    const args={p_actor:hr,p_task:submitted.task_id,p_key:randomUUID(),p_hash:"a".repeat(64),p_model:"fixture",p_prompt_version:"recruitment-v1"};const retried=await sqlRPC(db,"lc_retry_essay",args);expect(await sqlRPC(db,"lc_retry_essay",args)).toEqual(retried);
    provider();await runOneGeneration(pgQueue(db));expect(Number((await db.query<{interview_score:string}>("select interview_score from public.applications where id=$1",[id])).rows[0].interview_score)).toBe(88);
    expect((await db.query("select id from public.messages where kind='APPLICATION_EVALUATED'")).rows).toHaveLength(2);
  });
  it("browser roles cannot execute private grading RPCs; wrong owner cannot save/submit",async()=>{
    const id=await readyApplication(db);await start(db,id);
    await expect(sqlRPC(db,"lc_prepare_submission",{p_actor:hr,p_application:id,p_timeout:false})).rejects.toThrow("NOT_FOUND");
    await expect(sqlRPC(db,"lc_save_answers",{p_actor:hr,p_application:id,p_version:0,p_answers:{quiz:[],essay:[]}})).rejects.toThrow("NOT_FOUND");
    await db.exec("set role authenticated");try{await expect(sqlRPC(db,"lc_prepare_submission",{p_actor:candidate,p_application:id,p_timeout:false})).rejects.toThrow(/permission denied/);}finally{await db.exec("reset role");}
  });
  it("validates stored essay evidence and totals and rejects an expired lease",async()=>{
    const id=await readyApplication(db);await start(db,id);await save(db,id);await submitPersistedInterview(pgQueue(db),candidate,id,"fixture",false,1);
    const queue=pgQueue(db),first=randomUUID(),second=randomUUID(),task=await queue.claim(first);const raw=rawEssay();
    const essay={earned_points:8,max_points:10,score:80,summary:raw.summary,questions:raw.questions.map(q=>({...q,earned_points:8,max_points:10,criteria:q.criteria.map((c,i)=>({...c,max_points:i===0?6:4}))}))};
    const report=buildInterviewEvaluation(gradeQuiz(interviewAnswers,fixture.interview_questions),essay,{quiz_weight:40,essay_weight:60});
    const bad=structuredClone(report);bad.essay.questions[0].criteria[0].evidence=["not in the answer"];await expect(queue.completeEssay(task!.id,first,bad)).rejects.toThrow("INVALID_ESSAY_RESULT");
    const wrong=structuredClone(report);wrong.total_score=100;await expect(queue.completeEssay(task!.id,first,wrong)).rejects.toThrow("INVALID_ESSAY_RESULT");
    await queue.beginAttempt(task!.id,first,1);await db.query("update public.ai_tasks set lease_until=now()-interval '1 second' where id=$1",[task!.id]);expect((await queue.claim(second))?.network_attempts).toBe(1);
    expect(await queue.completeEssay(task!.id,first,report)).toBe(false);await queue.beginAttempt(task!.id,second,2);expect(await queue.completeEssay(task!.id,second,report)).toBe(true);expect(await queue.completeEssay(task!.id,second,report)).toBe(false);
    expect((await db.query("select id from public.messages where kind='APPLICATION_EVALUATED'")).rows).toHaveLength(2);
  });
  it("allows only two manual essay generations per 24 hours across candidate and HR",async()=>{
    const id=await readyApplication(db);await start(db,id);await save(db,id);let task=(await submitPersistedInterview(pgQueue(db),candidate,id,"fixture",false,1)).task_id;provider(true);await runOneGeneration(pgQueue(db));
    for(const actor of [candidate,hr]){
      const next=await sqlRPC<{task_id:string}>(db,"lc_retry_essay",{p_actor:actor,p_task:task,p_key:randomUUID(),p_hash:"a".repeat(64),p_model:"fixture",p_prompt_version:"recruitment-v1"});task=next.task_id;await runOneGeneration(pgQueue(db));
    }
    await expect(sqlRPC(db,"lc_retry_essay",{p_actor:candidate,p_task:task,p_key:randomUUID(),p_hash:"a".repeat(64),p_model:"fixture",p_prompt_version:"recruitment-v1"})).rejects.toThrow("ESSAY_RETRY_LIMITED");
    expect(await sqlRPC(db,"lc_essay_task",{p_actor:candidate,p_application:id})).toMatchObject({can_retry:false,state:"FAILED"});
  });
});
