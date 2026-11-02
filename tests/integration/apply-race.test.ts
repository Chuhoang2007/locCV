import { randomUUID,createHash } from "node:crypto";
import { afterEach,beforeEach,describe,it,expect,vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../helpers/database";
import { pgQueue,sqlRPC } from "../helpers/queue";
import { applyArgs,candidate,cvReport,hr,publishedJob } from "../helpers/applications";
import { syntheticCV } from "../helpers/cv-fixtures";
import { interviewEligibility } from "@/domain/applications";
import { runOneGeneration } from "../../worker/handlers/generate-job";
import { AIClientError } from "@/lib/ai-client";
let db:PGlite;
beforeEach(async()=>{db=await createTestDatabase();});afterEach(async()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();await db.close();});
describe("Phase 3 transactional acceptance and evaluation",()=>{
  it("competing apply requests create one application, one task and one receipt; idempotency replays",async()=>{
    const job=await publishedJob(db);const args=applyArgs(job);
    const results=await Promise.allSettled([sqlRPC(db,"lc_apply",args),sqlRPC(db,"lc_apply",applyArgs(job))]);
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
    expect((await db.query("select * from public.applications")).rows).toHaveLength(1);
    expect((await db.query("select * from public.ai_tasks")).rows).toHaveLength(1);expect((await db.query("select * from public.messages")).rows).toHaveLength(1);
    expect(await sqlRPC(db,"lc_apply",args)).toEqual((results[0] as PromiseFulfilledResult<unknown>).value);
    await expect(sqlRPC(db,"lc_apply",{...args,p_hash:"b".repeat(64)})).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("blocks self-apply irrespective of mode, closed jobs and missing acknowledgment/text",async()=>{
    const job=await publishedJob(db);
    for(const mode of ["HR","CANDIDATE"]){await db.query("update public.users set preferred_mode=$1 where id=$2",[mode,hr]);await expect(sqlRPC(db,"lc_apply",applyArgs(job,{p_actor:hr}))).rejects.toThrow("SELF_APPLICATION");}
    for(const overrides of [{p_ack:false},{p_text:""},{p_text:"x".repeat(30001)}])await expect(sqlRPC(db,"lc_apply",applyArgs(job,overrides))).rejects.toThrow("INVALID_INPUT");
    await sqlRPC(db,"lc_close_job",{p_actor:hr,p_job:job,p_version:3});await expect(sqlRPC(db,"lc_apply",applyArgs(job))).rejects.toThrow("JOB_NOT_PUBLISHED");
    expect((await db.query("select * from public.ai_tasks")).rows).toHaveLength(0);
  });
  it("accepted application keeps its snapshot and confirmed-text hash after closure",async()=>{
    const job=await publishedJob(db);const {application_id}=await sqlRPC<{application_id:string}>(db,"lc_apply",applyArgs(job));
    const before=(await db.query<{job_snapshot_json:unknown;cv_sha256:string}>("select job_snapshot_json,cv_sha256 from public.applications where id=$1",[application_id])).rows[0];
    expect(before.cv_sha256).toBe(createHash("sha256").update(syntheticCV).digest("hex"));
    await sqlRPC(db,"lc_close_job",{p_actor:hr,p_job:job,p_version:3});
    const lease=randomUUID();const task=await pgQueue(db).claim(lease);expect(await pgQueue(db).completeCV(task!.id,lease,cvReport())).toBe(true);
    expect((await db.query<{job_snapshot_json:unknown;status:string}>("select job_snapshot_json,status from public.applications where id=$1",[application_id])).rows[0]).toEqual({job_snapshot_json:before.job_snapshot_json,status:"CV_PASSED"});
  });
  it("recomputes scores and threshold from snapshot; rejects invented evidence, IDs and excessive scores",async()=>{
    await sqlRPC(db,"lc_apply",applyArgs(await publishedJob(db)));const lease=randomUUID(),queue=pgQueue(db),task=await queue.claim(lease);
    for(const mutate of [(r:ReturnType<typeof cvReport>)=>{r.criteria[0].evidence=["invented evidence"];},(r:ReturnType<typeof cvReport>)=>{r.criteria[0].score=61;},(r:ReturnType<typeof cvReport>)=>{r.criteria[0].criterion_id="unknown";}]){
      const report=cvReport();mutate(report);await expect(queue.completeCV(task!.id,lease,report)).rejects.toThrow("INVALID_CV_RESULT");
    }
    const report=cvReport();report.total_score=0;report.passed=false;expect(await queue.completeCV(task!.id,lease,report)).toBe(true);
    expect((await db.query<{cv_score:number;status:string}>("select cv_score,status from public.applications")).rows[0]).toEqual({cv_score:60,status:"CV_PASSED"});
    expect(await queue.completeCV(task!.id,lease,report)).toBe(false);expect((await db.query("select * from public.messages where kind='CV_EVALUATED'")).rows).toHaveLength(2);
    expect(interviewEligibility(60,60,"CV_THRESHOLD").eligible).toBe(true);expect(interviewEligibility(59,60,"CV_THRESHOLD").eligible).toBe(false);expect(interviewEligibility(59,60,"ALWAYS").eligible).toBe(true);expect(interviewEligibility(null,60,"ALWAYS").eligible).toBe(false);
  });
  it("worker evaluates real HTTP schema and failed AI never assigns zero or changes application status",async()=>{
    const {application_id}=await sqlRPC<{application_id:string}>(db,"lc_apply",applyArgs(await publishedJob(db)));
    const queue=pgQueue(db);await runOneGeneration(queue,{evaluate:async()=>{throw new AIClientError("INVALID_JSON");}});
    expect((await db.query<{status:string;cv_score:number|null}>("select status,cv_score from public.applications")).rows[0]).toEqual({status:"CV_SUBMITTED",cv_score:null});
    let task=(await db.query<{id:string}>("select id from public.ai_tasks")).rows[0];
    for(let i=0;i<2;i++){
      const result=await sqlRPC<{task_id:string}>(db,"lc_retry_cv",{p_actor:hr,p_task:task.id,p_key:randomUUID(),p_hash:"a".repeat(64),p_model:"fixture",p_prompt_version:"recruitment-v1"});
      await runOneGeneration(queue,{evaluate:async()=>{throw new AIClientError("INVALID_OUTPUT");}});task={id:result.task_id};
    }
    await expect(sqlRPC(db,"lc_retry_cv",{p_actor:candidate,p_task:task.id,p_key:randomUUID(),p_hash:"a".repeat(64),p_model:"fixture",p_prompt_version:"recruitment-v1"})).rejects.toThrow("CV_RETRY_LIMITED");
    const info=await sqlRPC<{can_retry:boolean}>(db,"lc_application_task",{p_actor:candidate,p_application:application_id});expect(info.can_retry).toBe(false);
    expect((await db.query("select * from public.messages where kind='CV_EVALUATED'")).rows).toHaveLength(0);
  });
  it("two consumers evaluate CV from the saved rubric through the HTTP client once",async()=>{
    vi.stubEnv("NINE_ROUTER_BASE_URL","https://fixture.nine.test/v1");vi.stubEnv("NINE_ROUTER_API_KEY","fixture-only");vi.stubEnv("NINE_ROUTER_MODEL","fixture");
    const report=cvReport();const raw={criteria:report.criteria.map(c=>({criterion_id:c.criterion_id,score:c.score,evidence:c.evidence,missing_evidence:c.missing_evidence,feedback:c.feedback})),summary:report.summary};
    const provider=vi.fn(async(_url:unknown,init?:RequestInit)=>{
      const request=JSON.parse(String(init?.body));const payload=JSON.parse(request.messages[1].content);expect(payload.cv_text).toBe(syntheticCV);expect(payload.scoring_rubric.pass_threshold).toBe(60);
      return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:JSON.stringify(raw)}}]}));
    });vi.stubGlobal("fetch",provider);
    await sqlRPC(db,"lc_apply",applyArgs(await publishedJob(db)));const queue=pgQueue(db);
    expect((await Promise.all([runOneGeneration(queue),runOneGeneration(queue)])).filter(Boolean)).toHaveLength(1);expect(provider).toHaveBeenCalledTimes(1);
    expect((await db.query<{status:string}>("select status from public.applications")).rows[0].status).toBe("CV_PASSED");
    expect((await db.query("select id from public.messages where kind='CV_EVALUATED'")).rows).toHaveLength(2);
  });
  it("expired CV lease cannot commit; reclaim retains attempt budget",async()=>{
    await sqlRPC(db,"lc_apply",applyArgs(await publishedJob(db)));const queue=pgQueue(db),first=randomUUID(),second=randomUUID();const task=await queue.claim(first);
    await queue.beginAttempt(task!.id,first,1);await db.query("update public.ai_tasks set lease_until=now()-interval '1 second' where id=$1",[task!.id]);
    const reclaimed=await queue.claim(second);expect(reclaimed?.network_attempts).toBe(1);expect(await queue.completeCV(task!.id,first,cvReport())).toBe(false);
    await queue.beginAttempt(task!.id,second,2);expect(await queue.completeCV(task!.id,second,cvReport())).toBe(true);
  });
});
