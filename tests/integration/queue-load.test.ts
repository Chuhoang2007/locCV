import { expect,it,vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "../helpers/database";
import { sqlRPC,pgQueue } from "../helpers/queue";
import { runOneGeneration } from "../../worker/handlers/generate-job";
import fixture from "../fixtures/generated-job.json";
it("twenty queued generations, two consumers, transient/network/invalid JSON and a crash retain bounded attempts",async()=>{
  const db=await createTestDatabase();
  vi.stubEnv("NINE_ROUTER_BASE_URL","https://fixture.nine.test/v1");vi.stubEnv("NINE_ROUTER_API_KEY","fixture-only");vi.stubEnv("NINE_ROUTER_MODEL","fixture");
  const counts=new Map<number,number>();
  vi.stubGlobal("fetch",vi.fn(async(_url,init)=>{const body=JSON.parse(init.body as string),payload=JSON.parse(body.messages[1].content);const n=Number(payload.raw_hr_prompt.match(/case (\d+)/)[1]),attempt=(counts.get(n)??0)+1;counts.set(n,attempt);
    if(n%5===0&&attempt===1)return new Response("starting",{status:502});
    if(n%5===1&&attempt===1)throw new TypeError("synthetic network failure");
    if(n%5===2)return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:"{invalid"}}]}));
    return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:JSON.stringify(fixture)}}]}));}));
  try{
    for(let i=0;i<20;i++){const actor=randomUUID();await db.query("insert into auth.users(id,email) values($1,$2)",[actor,`synthetic-${i}@example.test`]);await sqlRPC(db,"lc_create_job",{p_actor:actor,p_prompt:`Synthetic case ${i}: TypeScript recruitment`,p_generate:true,p_key:randomUUID(),p_hash:"a".repeat(64),p_model:"fixture",p_prompt_version:"recruitment-v1"});}
    // A process dies after consuming an HTTP attempt, before any result is committed.
    const queue=pgQueue(db),lease=randomUUID(),lost=await queue.claim(lease);await queue.beginAttempt(lost!.id,lease,1);await db.query("update public.ai_tasks set lease_until=now()-interval '1 second' where id=$1",[lost!.id]);
    async function consume(){while(await runOneGeneration(queue)){};}
    await Promise.all([consume(),consume()]);
    const tasks=(await db.query<{state:string;network_attempts:number}>("select state,network_attempts from public.ai_tasks")).rows;
    expect(tasks).toHaveLength(20);expect(tasks.filter(t=>t.state==="SUCCEEDED")).toHaveLength(16);expect(tasks.filter(t=>t.state==="FAILED")).toHaveLength(4);expect(tasks.every(t=>t.network_attempts<=3)).toBe(true);expect([...counts.values()].every(n=>n<=3)).toBe(true);
    expect((await db.query("select id from public.audit_events where event_type='JOB_GENERATED'")).rows).toHaveLength(16);
    expect(await queue.complete(lost!.id,lease,fixture)).toBe(false);
  }finally{vi.unstubAllGlobals();vi.unstubAllEnvs();await db.close();}
},60000);
