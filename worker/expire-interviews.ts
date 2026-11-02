import { submitPersistedInterview } from "../src/server/interview-submission.js";
import type { QueueStore } from "./queue.js";
export async function expireInterviews(store:QueueStore,model:string,options:{signal?:AbortSignal;log?:(value:{application_id:string;code:string})=>void}={}){
  const ids=await store.dueInterviews(100);let submitted=0;
  for(const id of ids){
    if(options.signal?.aborted)break;
    try{await submitPersistedInterview(store,null,id,model,true);submitted++;}
    catch{options.log?.({application_id:id,code:"INTERVIEW_TIMEOUT_RETRY_LATER"});}
  }
  return submitted;
}
