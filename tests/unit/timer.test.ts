import { describe,it,expect } from "vitest";
import { remainingMilliseconds,timerAnchor,timerLabel } from "@/domain/interview-timer";
import { readAnswerBuffer,writeAnswerBuffer,clearAnswerBuffers,BUFFER_TTL_MS } from "@/domain/answer-buffer";
function memoryStorage(){
  const values:Record<string,string>={};Object.defineProperties(values,{
    getItem:{value:(key:string)=>values[key]??null},setItem:{value:(key:string,value:string)=>{values[key]=value;}},removeItem:{value:(key:string)=>{delete values[key];}},
  });return values as unknown as Storage;
}
describe("Server-relative time and optional recovery buffer",()=>{
  it("uses a monotonic anchor rather than the client wall clock and clamps at zero",()=>{
    const anchor=timerAnchor("2026-11-02T00:00:00Z","2026-11-02T00:05:00Z",200);
    expect(remainingMilliseconds(anchor,60200)).toBe(240000);expect(remainingMilliseconds(anchor,400200)).toBe(0);expect(timerLabel(240)).toBe("04:00");
    const resumed=timerAnchor("2026-11-02T00:03:00Z","2026-11-02T00:05:00Z",900000);expect(remainingMilliseconds(resumed,900000)).toBe(120000);
    expect(()=>timerAnchor("invalid","invalid",0)).toThrow();
  });
  it("scopes buffers to user, application and version, then expires and clears only that application",()=>{
    const storage=memoryStorage(),answers={quiz:[],essay:[{question_id:"e_api",text:"draft answer"}]};
    writeAnswerBuffer(storage,"a","app-1",2,answers,1000);writeAnswerBuffer(storage,"b","app-1",1,answers,1000);writeAnswerBuffer(storage,"a","app-2",1,answers,1000);
    expect(Object.keys(storage)).toContain("loccv-answers:a:app-1:v1:2");expect(readAnswerBuffer(storage,"a","app-1",1100)?.answer_version).toBe(2);
    expect(readAnswerBuffer(storage,"a","app-1",1000+BUFFER_TTL_MS)).toBeNull();expect(readAnswerBuffer(storage,"b","app-1",1100)).not.toBeNull();
    clearAnswerBuffers(storage,"b","app-1");expect(readAnswerBuffer(storage,"b","app-1",1100)).toBeNull();expect(readAnswerBuffer(storage,"a","app-2",1100)).not.toBeNull();
  });
  it("discards malformed buffers and refuses CV, tokens and arbitrary extra fields",()=>{
    const storage=memoryStorage();storage.setItem("loccv-answers:a:app:v1:0",JSON.stringify({schema_version:1,answer_version:0,answers:{quiz:[],essay:[]},updated_at:1000,token:"must not be stored"}));
    expect(readAnswerBuffer(storage,"a","app",1001)).toBeNull();expect(Object.keys(storage)).toHaveLength(0);
  });
});
