import { randomUUID } from "node:crypto";
import { AIClientError, generateJobAndAssessment, evaluateCandidateCV, evaluateInterviewAnswers, PROMPT_VERSION } from "../../src/lib/ai-client.js";
import type { QueueStore } from "../queue.js";
import { startHeartbeat } from "../heartbeat.js";
import { evaluateCVTask } from "./evaluate-cv.js";
import { evaluateEssayTask } from "./evaluate-essay.js";

export async function runOneGeneration(store: QueueStore,options: {
  signal?:AbortSignal; generate?:typeof generateJobAndAssessment; evaluate?:typeof evaluateCandidateCV; essay?:typeof evaluateInterviewAnswers; heartbeatMs?:number;
  log?:(data:{task_id:string;code:string})=>void;
} = {}):Promise<boolean>{
  // Một lease UUID mới mỗi claim, kể cả cùng một worker phục hồi lại task.
  const lease=randomUUID();
  const task=await store.claim(lease);
  if(!task)return false;
  const controller=new AbortController();
  const stop=()=>controller.abort();
  options.signal?.addEventListener("abort",stop,{once:true});
  if(options.signal?.aborted)controller.abort();
  const stopHeartbeat=startHeartbeat(store,task.id,lease,controller,options.heartbeatMs);
  try{
    if(controller.signal.aborted)return true;
    const job=task.kind==="GENERATE_JOB"&&task.job_id?await store.getJob(task.job_id):null;
    if(task.kind==="GENERATE_JOB"&&(!job||job.status!=="DRAFT" || job.version!==task.input_version)){await store.fail(task.id,lease,"VERSION_CONFLICT");return true;}
    if(task.prompt_version!==PROMPT_VERSION){await store.fail(task.id,lease,"PROMPT_VERSION_CHANGED");return true;}
    const callOptions={
      signal:controller.signal,model:task.model,startAttempt:task.network_attempts+1,
      beforeAttempt:async (attempt:number)=>{
        if(!await store.beginAttempt(task.id,lease,attempt)){controller.abort();throw new AIClientError("CANCELLED");}
      },
      onProgress:async (progress:import("../../src/lib/ai-client.js").Progress)=>{
        if(progress.state==="RETRY_WAIT")options.log?.({task_id:task.id,code:`AI_RETRY_${progress.error_code}`});
        if(progress.state==="RETRY_WAIT" && !await store.retryWait(task.id,lease,progress.next_retry_at!,progress.error_code!)){
          controller.abort();throw new AIClientError("CANCELLED");
        }
      },
    };
    const data=task.kind==="EVALUATE_ESSAY"?await evaluateEssayTask(store,task,callOptions,options.essay):task.kind==="EVALUATE_CV"?await evaluateCVTask(store,task,callOptions,options.evaluate):await (options.generate??generateJobAndAssessment)(job!.raw_hr_prompt??"",callOptions);
    if(!controller.signal.aborted){
      const completed=task.kind==="EVALUATE_ESSAY"?await store.completeEssay(task.id,lease,data):task.kind==="EVALUATE_CV"?await store.completeCV(task.id,lease,data):await store.complete(task.id,lease,data);
      options.log?.({task_id:task.id,code:completed?"TASK_SUCCEEDED":"LEASE_LOST"});
    }
  }catch(error){
    // Shutdown/mất lease để lease hết hạn, budget đã tiêu thụ vẫn được giữ.
    if(!controller.signal.aborted){
      const code=error instanceof AIClientError?error.code:"WORKER_ERROR";
      await store.fail(task.id,lease,code).catch(()=>undefined);
      options.log?.({task_id:task.id,code});
    }
  }finally{stopHeartbeat();options.signal?.removeEventListener("abort",stop);}
  return true;
}
