import { z } from "zod";
import { candidateAnswersSchema,type CandidateAnswers } from "./answer-validation.ts";
export const BUFFER_TTL_MS=24*60*60*1000;
export const bufferSchema=z.strictObject({schema_version:z.literal(1),answer_version:z.number().int().min(0),answers:candidateAnswersSchema,updated_at:z.number().int().nonnegative()});
export type AnswerBuffer=z.infer<typeof bufferSchema>;
export function bufferPrefix(user:string,application:string){return `loccv-answers:${user}:${application}:v1:`;}
export function clearAnswerBuffers(storage:Storage,user:string,application:string){for(const key of Object.keys(storage))if(key.startsWith(bufferPrefix(user,application)))storage.removeItem(key);}
export function readAnswerBuffer(storage:Storage,user:string,application:string,now=Date.now()){
  const items:AnswerBuffer[]=[];
  for(const key of Object.keys(storage)){
    if(!key.startsWith(bufferPrefix(user,application)))continue;
    try{const item=bufferSchema.parse(JSON.parse(storage.getItem(key)??"null"));if(now-item.updated_at>=BUFFER_TTL_MS||item.updated_at>now+60000){storage.removeItem(key);continue;}items.push(item);}
    catch{storage.removeItem(key);}
  }
  return items.sort((a,b)=>b.updated_at-a.updated_at)[0]??null;
}
export function writeAnswerBuffer(storage:Storage,user:string,application:string,version:number,answers:CandidateAnswers,now=Date.now()){
  storage.setItem(bufferPrefix(user,application)+version,JSON.stringify(bufferSchema.parse({schema_version:1,answer_version:version,answers,updated_at:now})));
}
export function clearMatchingAnswerBuffers(storage:Storage,user:string,application:string,answers:CandidateAnswers){
  const body=JSON.stringify(answers);for(const key of Object.keys(storage))if(key.startsWith(bufferPrefix(user,application))){try{if(JSON.stringify(JSON.parse(storage.getItem(key)??"null").answers)===body)storage.removeItem(key);}catch{storage.removeItem(key);}}
}
