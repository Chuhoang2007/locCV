export type TimerAnchor={serverMs:number;deadlineMs:number;monotonicMs:number};
export function timerAnchor(serverNow:string,deadline:string,monotonicMs:number):TimerAnchor{
  const serverMs=Date.parse(serverNow),deadlineMs=Date.parse(deadline);
  if(!Number.isFinite(serverMs)||!Number.isFinite(deadlineMs)||!Number.isFinite(monotonicMs))throw new Error("INVALID_TIMER");
  return {serverMs,deadlineMs,monotonicMs};
}
export function remainingMilliseconds(anchor:TimerAnchor,monotonicMs:number){return Math.max(0,anchor.deadlineMs-anchor.serverMs-Math.max(0,monotonicMs-anchor.monotonicMs));}
export function timerLabel(seconds:number){const s=Math.max(0,Math.ceil(seconds));return `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;}
