import "server-only";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { setTimeout as wait } from "node:timers/promises";
import { getAISettings } from "../src/lib/env.js";
import { createQueueStore } from "./queue.js";
import { runOneGeneration } from "./handlers/generate-job.js";
import { expireInterviews } from "./expire-interviews.js";
import { createPurgeStore,purgeData } from "./purge-data.js";
import { readOperations } from "./operations.js";

if(existsSync(".env.local"))process.loadEnvFile(".env.local");
const shutdown=new AbortController();
for(const signal of ["SIGINT","SIGTERM"] as const)process.on(signal,()=>shutdown.abort());
try{
  const ai=getAISettings();
  const store=createQueueStore();
  let lastHealthy=0;
  let checking=false;
  const healthCheck=async()=>{if(checking||shutdown.signal.aborted)return;checking=true;try{await store.health();lastHealthy=Date.now();}catch{/* Readiness ages out; loops retry safely. */}finally{checking=false;}};
  const server=createServer((request,response)=>{
    if(request.url!=="/health"){response.writeHead(404).end();return;}
    const healthy=Date.now()-lastHealthy<30_000 && !shutdown.signal.aborted;
    response.writeHead(healthy?200:503,{"Content-Type":"application/json"}).end(JSON.stringify({status:healthy?"ready":"unavailable",concurrency:2}));
  });
  const port=Number(process.env.WORKER_HEALTH_PORT??3310);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error("INVALID_WORKER_PORT");
  const host=process.env.WORKER_HEALTH_HOST??"127.0.0.1";
  if(!["127.0.0.1","0.0.0.0"].includes(host))throw new Error("INVALID_WORKER_HOST");
  await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(port,host,resolve);});
  const healthTimer=setInterval(()=>{void healthCheck();},10_000);healthTimer.unref();void healthCheck();
  const log=(data:{task_id:string;code:string})=>console.log(JSON.stringify(data));
  async function loop(){
    while(!shutdown.signal.aborted){
      try{
        const worked=await runOneGeneration(store,{signal:shutdown.signal,log});
        if(!worked)await wait(1000,undefined,{signal:shutdown.signal}).catch(()=>undefined);
      }catch{
        if(!shutdown.signal.aborted){console.error(JSON.stringify({code:"QUEUE_UNAVAILABLE"}));await wait(3000,undefined,{signal:shutdown.signal}).catch(()=>undefined);}
      }
    }
  }
  console.log(JSON.stringify({code:"WORKER_STARTED",concurrency:2,health_port:port}));
  async function sweep(){
    while(!shutdown.signal.aborted){
      try{await expireInterviews(store,ai.model,{signal:shutdown.signal,log:value=>console.log(JSON.stringify(value))});}
      catch{if(!shutdown.signal.aborted)console.error(JSON.stringify({code:"INTERVIEW_SWEEP_UNAVAILABLE"}));}
      await wait(15000,undefined,{signal:shutdown.signal}).catch(()=>undefined);
    }
  }
  async function maintenance(){
    const purge=createPurgeStore();
    while(!shutdown.signal.aborted){
      try{
        const metrics=await readOperations();console.log(JSON.stringify({code:"OPERATIONS",...metrics}));
        if(metrics.oldest_queue_seconds>300||metrics.autosubmit_lag_seconds>60||metrics.failed_24h>0)console.warn(JSON.stringify({code:"OPERATIONS_ATTENTION",queue_age_seconds:metrics.oldest_queue_seconds,autosubmit_lag_seconds:metrics.autosubmit_lag_seconds,failed_24h:metrics.failed_24h}));
        await purgeData(purge,process.env.DATA_RETENTION_ENABLED==="true",shutdown.signal,value=>console.log(JSON.stringify(value)));
      }catch{if(!shutdown.signal.aborted)console.error(JSON.stringify({code:"MAINTENANCE_UNAVAILABLE"}));}
      await wait(60000,undefined,{signal:shutdown.signal}).catch(()=>undefined);
    }
  }
  await Promise.all([loop(),loop(),sweep(),maintenance()]);
  clearInterval(healthTimer);
  server.close();
}catch{
  console.error(JSON.stringify({code:"WORKER_CONFIGURATION_OR_STARTUP_ERROR"}));
  process.exitCode=1;
}
