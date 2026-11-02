import type { QueueStore } from "./queue.js";
export function startHeartbeat(store: QueueStore,task: string,lease: string,controller: AbortController,intervalMs=15_000) {
  let busy=false;
  const timer=setInterval(async()=>{
    if(busy || controller.signal.aborted)return;
    busy=true;
    try {if(!await store.heartbeat(task,lease))controller.abort();}
    catch{controller.abort();}
    finally{busy=false;}
  },intervalMs);
  timer.unref();
  return ()=>clearInterval(timer);
}
