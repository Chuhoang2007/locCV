import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import fixture from "../fixtures/generated-job.json";
import { AIClientError,cleanAndParseJSON,generateJobAndAssessment } from "@/lib/ai-client";
const envelope=(data:unknown)=>new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:typeof data==="string"?data:JSON.stringify(data)}}]}),{status:200});
beforeEach(()=>{vi.stubEnv("NINE_ROUTER_BASE_URL","https://fixture.nine.test/v1");vi.stubEnv("NINE_ROUTER_API_KEY","fixture-only");vi.stubEnv("NINE_ROUTER_MODEL","gpt-4o-mini");});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe("Nine Router transport không gọi mạng thật",()=>{
  it("sanitizer đọc JSON thuần, BOM, fenced, prose, ngoặc trong string",()=>{
    const value={quote:'x } [ \\ " y',nested:[{ok:true}]};const json=JSON.stringify(value);
    for(const raw of [json,"\uFEFF"+json,"```json\n"+json+"\n```","Kết quả: "+json])expect(cleanAndParseJSON(raw)).toEqual(value);
    for(const raw of ["{} {}","null","123",'{"x":}','{"x":1,}',"not JSON"])expect(()=>cleanAndParseJSON(raw)).toThrow(AIClientError);
  });
  it("502 → 504 → thành công chỉ có ba request",async()=>{
    vi.useFakeTimers({toFake:["setTimeout","clearTimeout","Date"]});let calls=0;
    const mock=vi.fn(async()=>++calls<3?new Response("",{status:calls===1?502:504}):envelope(fixture));vi.stubGlobal("fetch",mock);
    const promise=generateJobAndAssessment("Tuyển developer TypeScript");await vi.runAllTimersAsync();expect(await promise).toEqual(fixture);expect(mock).toHaveBeenCalledTimes(3);
  });
  it("timeout đúng 60s mỗi attempt và dừng sau ba lần",async()=>{
    vi.useFakeTimers({toFake:["setTimeout","clearTimeout","Date"]});const start=Date.now();
    const mock=vi.fn((_url:unknown,init:RequestInit)=>new Promise<Response>((_resolve,reject)=>init.signal?.addEventListener("abort",()=>reject(new DOMException("abort","AbortError")),{once:true})));vi.stubGlobal("fetch",mock);
    const promise=expect(generateJobAndAssessment("Tuyển developer TypeScript")).rejects.toMatchObject({code:"TIMEOUT"});await vi.runAllTimersAsync();await promise;expect(mock).toHaveBeenCalledTimes(3);expect(Date.now()-start).toBeGreaterThanOrEqual(180000);
  });
  it.each([[401,"UPSTREAM_AUTH"],[429,"RATE_LIMITED"],[503,"UPSTREAM_ERROR"]])("không retry HTTP %s",async(status,code)=>{
    const mock=vi.fn(async()=>new Response("secret upstream body",{status:Number(status)}));vi.stubGlobal("fetch",mock);
    await expect(generateJobAndAssessment("Tuyển developer TypeScript")).rejects.toMatchObject({code});expect(mock).toHaveBeenCalledTimes(1);
  });
  it("JSON/schema sai không retry, không chấp nhận thang điểm 99",async()=>{
    const bad=structuredClone(fixture);bad.scoring_rubric.criteria[0].max_points=59;
    for(const output of ["{broken",bad]){const mock=vi.fn(async()=>envelope(output));vi.stubGlobal("fetch",mock);await expect(generateJobAndAssessment("Tuyển developer TypeScript")).rejects.toBeInstanceOf(AIClientError);expect(mock).toHaveBeenCalledTimes(1);}
  });
  it("model_not_found báo mã riêng và không tự chọn model khác",async()=>{
    const mock=vi.fn(async()=>new Response(JSON.stringify({error:{code:"model_not_found",message:"private upstream"}}),{status:404}));vi.stubGlobal("fetch",mock);
    await expect(generateJobAndAssessment("Tuyển developer TypeScript")).rejects.toMatchObject({code:"MODEL_UNAVAILABLE"});expect(mock).toHaveBeenCalledTimes(1);
  });
  it("budget phục hồi và callback mất lease không gửi HTTP",async()=>{
    const mock=vi.fn(async()=>envelope(fixture));vi.stubGlobal("fetch",mock);
    await expect(generateJobAndAssessment("Tuyển developer TypeScript",{startAttempt:4})).rejects.toMatchObject({code:"ATTEMPTS_EXHAUSTED"});
    await expect(generateJobAndAssessment("Tuyển developer TypeScript",{beforeAttempt:async()=>{throw new Error("LEASE_LOST");}})).rejects.toThrow("LEASE_LOST");expect(mock).not.toHaveBeenCalled();
    await generateJobAndAssessment("Tuyển developer TypeScript",{startAttempt:3});expect(mock).toHaveBeenCalledTimes(1);
  });
  it("hủy trong backoff không retry",async()=>{
    vi.useFakeTimers({toFake:["setTimeout","clearTimeout","Date"]});const controller=new AbortController();const mock=vi.fn(async()=>new Response("",{status:502}));vi.stubGlobal("fetch",mock);
    const promise=expect(generateJobAndAssessment("Tuyển developer TypeScript",{signal:controller.signal})).rejects.toMatchObject({code:"CANCELLED"});setTimeout(()=>controller.abort(),100);await vi.runAllTimersAsync();await promise;expect(mock).toHaveBeenCalledTimes(1);
  });
});
