import { randomUUID } from "node:crypto";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import fixture from "../fixtures/generated-job.json";
import { createTestDatabase } from "../helpers/database";
import { pgQueue,sqlRPC } from "../helpers/queue";
import { runOneGeneration } from "../../worker/handlers/generate-job";
import { GeneratedJobSchema } from "@/lib/ai-schemas";

const hr="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
const hash="a".repeat(64);let db:PGlite;
beforeEach(async()=>{db=await createTestDatabase();});afterEach(async()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();await db.close();});
async function create(generate=false,key=randomUUID()){
  return sqlRPC<{job_id:string;task_id:string|null}>(db,"lc_create_job",{p_actor:hr,p_prompt:"Tuyển lập trình viên TypeScript có kiểm thử",p_generate:generate,p_key:key,p_hash:hash,p_model:"gpt-4o-mini",p_prompt_version:"recruitment-v1"});
}
async function save(id:string,version=1,content:unknown=fixture){return sqlRPC<{version:number}>(db,"lc_save_job",{p_actor:hr,p_job:id,p_version:version,p_draft:{...content as object,interview_access_policy:"CV_THRESHOLD"}});}
async function publish(id:string,version:number){return sqlRPC<{status:string;version:number}>(db,"lc_publish_job",{p_actor:hr,p_job:id,p_version:version});}
async function row(table:string,id:string){return (await db.query<Record<string,unknown>>(`select * from public.${table} where id=$1`,[id])).rows[0];}
function fakeProvider(){
  vi.stubEnv("NINE_ROUTER_BASE_URL","https://fixture.nine.test/v1");vi.stubEnv("NINE_ROUTER_API_KEY","fixture-only");vi.stubEnv("NINE_ROUTER_MODEL","gpt-4o-mini");
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:JSON.stringify(fixture)}}]}),{status:200})));
}

describe("Phase 2 SQL và worker thực trên PostgreSQL nhúng",()=>{
  it("tạo nháp + task + idempotency nguyên tử; replay không tạo thêm",async()=>{
    const key=randomUUID();const first=await create(true,key);expect(first.task_id).toBeTruthy();expect(await create(true,key)).toEqual(first);
    expect((await db.query("select id from public.jobs")).rows).toHaveLength(1);
    expect((await db.query("select id from public.ai_tasks")).rows).toHaveLength(1);
    await expect(sqlRPC(db,"lc_create_job",{p_actor:hr,p_prompt:"Payload khác",p_generate:true,p_key:key,p_hash:"b".repeat(64),p_model:"gpt-4o-mini",p_prompt_version:"recruitment-v1"})).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("không lộ tin riêng; không cho actor khác sửa/đăng/đóng",async()=>{
    const {job_id:id}=await create();
    for(const name of ["lc_save_job","lc_publish_job","lc_close_job"]){
      await expect(sqlRPC(db,name,{p_actor:other,p_job:id,p_version:1,...(name==="lc_save_job"?{p_draft:{...fixture,interview_access_policy:"CV_THRESHOLD"}}:{})})).rejects.toThrow("NOT_FOUND");
    }
    expect(await sqlRPC(db,"lc_public_job",{p_job:id})).toBeNull();
    const privilege=(await db.query<{ok:boolean}>("select has_function_privilege('authenticated','public.lc_publish_job(uuid,uuid,integer)','EXECUTE') as ok")).rows[0];expect(privilege.ok).toBe(false);
  });
  it("hai worker chỉ xử lý một task, kết quả cần HR duyệt",async()=>{
    fakeProvider();const created=await create(true);const queue=pgQueue(db);
    const processed=await Promise.all([runOneGeneration(queue),runOneGeneration(queue)]);
    expect(processed.filter(Boolean)).toHaveLength(1);
    const task=await row("ai_tasks",created.task_id!);expect(task.state).toBe("SUCCEEDED");expect(task.network_attempts).toBe(1);
    const job=await row("jobs",created.job_id);expect(job.status).toBe("DRAFT");expect(job.title).toBe(fixture.jd.title);expect(job.version).toBe(3);
    expect(await sqlRPC(db,"lc_public_job",{p_job:created.job_id})).toBeNull();
  });
  it("lease cũ không heartbeat/commit được sau khi worker khác claim",async()=>{
    const created=await create(true);const first=randomUUID(),second=randomUUID();const queue=pgQueue(db);
    await queue.claim(first);expect(await queue.beginAttempt(created.task_id!,first,1)).toBe(true);
    await db.query("update public.ai_tasks set lease_until=now()-interval '1 second' where id=$1",[created.task_id]);
    const reclaimed=await queue.claim(second);expect(reclaimed?.network_attempts).toBe(1);
    expect(await queue.heartbeat(created.task_id!,first)).toBe(false);
    expect(await queue.complete(created.task_id!,first,fixture)).toBe(false);
    expect(await queue.beginAttempt(created.task_id!,second,2)).toBe(true);
    expect(await queue.complete(created.task_id!,second,fixture)).toBe(true);
    expect((await row("ai_tasks",created.task_id!)).network_attempts).toBe(2);
  });
  it("phục hồi không reset budget; đủ ba attempt chết worker thì FAILED",async()=>{
    const created=await create(true);const lease=randomUUID();const queue=pgQueue(db);await queue.claim(lease);
    for(const n of [1,2,3])expect(await queue.beginAttempt(created.task_id!,lease,n)).toBe(true);
    await db.query("update public.ai_tasks set lease_until=now()-interval '1 second' where id=$1",[created.task_id]);
    expect(await queue.claim(randomUUID())).toBeNull();
    expect((await row("ai_tasks",created.task_id!)).state).toBe("FAILED");expect((await row("ai_tasks",created.task_id!)).network_attempts).toBe(3);
  });
  it("không claim task RETRY_WAIT còn lease hợp lệ",async()=>{
    const created=await create(true);const lease=randomUUID();const queue=pgQueue(db);await queue.claim(lease);await queue.beginAttempt(created.task_id!,lease,1);
    await queue.retryWait(created.task_id!,lease,new Date(Date.now()-1000).toISOString(),"UPSTREAM_TRANSIENT");
    expect(await queue.claim(randomUUID())).toBeNull();
  });
  it("AI không ghi đè thay đổi HR trong lúc chạy",async()=>{
    const created=await create(true);const lease=randomUUID();const queue=pgQueue(db);await queue.claim(lease);await queue.beginAttempt(created.task_id!,lease,1);
    const changed=structuredClone(fixture);changed.jd.title="Bản HR đã chỉnh";await save(created.job_id,2,changed);
    await queue.complete(created.task_id!,lease,fixture);
    expect((await row("jobs",created.job_id)).title).toBe("Bản HR đã chỉnh");expect((await row("ai_tasks",created.task_id!)).error_code).toBe("VERSION_CONFLICT");
  });
  it("publish yêu cầu tổng 100 và đáp án thuộc lựa chọn, rồi đóng băng nội dung",async()=>{
    const {job_id:id}=await create();const bad=structuredClone(fixture);bad.scoring_rubric.criteria[0].max_points=59;
    await save(id,1,bad);await expect(publish(id,2)).rejects.toThrow("INVALID_DRAFT");
    bad.scoring_rubric.criteria[0].max_points=60;bad.interview_questions.quiz[0].correct_answer="missing";await save(id,2,bad);await expect(publish(id,3)).rejects.toThrow("INVALID_DRAFT");
    await save(id,3);const published=await publish(id,4);expect(published.status).toBe("PUBLISHED");expect(await publish(id,4)).toEqual(published);
    await expect(save(id,5)).rejects.toThrow("JOB_NOT_DRAFT");
    await expect(db.query("update public.jobs set title='Forbidden' where id=$1",[id])).rejects.toThrow("PUBLISHED_JOB_IS_IMMUTABLE");
    expect((await db.query("select id from public.audit_events where event_type='JOB_PUBLISHED'")).rows).toHaveLength(1);
  });
  it("tìm có/không dấu, kỹ năng, lương; DTO public không có đề/đáp án",async()=>{
    const {job_id:id}=await create();const edited=structuredClone(fixture);edited.jd.title="Lập trình viên Frontend";await save(id,1,edited);await publish(id,2);
    for(const q of ["lập trình","lap trinh"]){
      const list=await sqlRPC<unknown[]>(db,"lc_search_jobs",{p_q:q,p_skill:"KIỂM THỬ",p_min:25000000,p_max:35000000,p_before_time:null,p_before_id:null,p_limit:20});expect(list).toHaveLength(1);expect(JSON.stringify(list)).not.toMatch(/correct_answer|scoring_guidance|raw_hr_prompt|quiz_weight/);
    }
    const detail=await sqlRPC(db,"lc_public_job",{p_job:id});expect(JSON.stringify(detail)).not.toMatch(/correct_answer|scoring_guidance|"quiz"|"essay"/);
    await sqlRPC(db,"lc_close_job",{p_actor:hr,p_job:id,p_version:3});expect(await sqlRPC(db,"lc_public_job",{p_job:id})).toBeNull();
  });
  it("keyset pagination không lặp tin cùng timestamp",async()=>{
    for(let i=0;i<3;i++){const {job_id:id}=await create();await save(id);await publish(id,2);}
    const first=await sqlRPC<{id:string;published_at:string}[]>(db,"lc_search_jobs",{p_q:"",p_skill:"",p_min:null,p_max:null,p_before_time:null,p_before_id:null,p_limit:1});
    expect(first).toHaveLength(2);
    const next=await sqlRPC<{id:string}[]>(db,"lc_search_jobs",{p_q:"",p_skill:"",p_min:null,p_max:null,p_before_time:first[0].published_at,p_before_id:first[0].id,p_limit:1});expect(next[0].id).not.toBe(first[0].id);
  });
  it("quota bền vững, generation thứ sáu trong giờ bị chặn nguyên tử",async()=>{
    for(let i=0;i<5;i++)await create(true);
    await expect(create(true)).rejects.toThrow("RATE_LIMITED");
    expect((await db.query("select id from public.jobs")).rows).toHaveLength(5);
  });
  it("schema generated hợp lệ và save dùng expected_version",async()=>{
    expect(GeneratedJobSchema.safeParse(fixture).success).toBe(true);
    const {job_id:id}=await create();await save(id);
    await expect(save(id,1)).rejects.toThrow("VERSION_CONFLICT");
  });
});
