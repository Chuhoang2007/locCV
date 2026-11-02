"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { candidateAnswersSchema,validateAnswerIDs,type CandidateAnswers } from "@/domain/answer-validation";
import { clearAnswerBuffers,clearMatchingAnswerBuffers,readAnswerBuffer,writeAnswerBuffer,type AnswerBuffer } from "@/domain/answer-buffer";
import { interviewDTOSchema,savedAnswersDTOSchema,type InterviewDTO } from "@/domain/interview";
import { timerAnchor } from "@/domain/interview-timer";
import { ClientAPIError,clientJSON } from "@/lib/client-api";
type SaveState="SAVED"|"DIRTY"|"SAVING"|"OFFLINE"|"CONFLICT"|"CLOSED"|"INVALID";
export function useAnswerAutosave(initial:InterviewDTO,userId:string,onClosed:()=>void){
  const [answers,setAnswers]=useState<CandidateAnswers>(initial.answers??{quiz:[],essay:[]});
  const [version,setVersion]=useState(initial.answer_version);const [savedAt,setSavedAt]=useState(initial.saved_at);
  const [status,setStatus]=useState<SaveState>("SAVED"),[error,setError]=useState("");
  const [localEnabled,setLocalEnabled]=useState(false),[recovery,setRecovery]=useState<AnswerBuffer|null>(null);
  const [clock,setClock]=useState(()=>timerAnchor(initial.server_now,initial.deadline_at!,performance.now()));
  const values=useRef(answers),currentVersion=useRef(version),sequence=useRef(0),dirty=useRef(false),blocked=useRef(false),local=useRef(false),alive=useRef(true);
  const signedOut=useRef(false);
  const pending=useRef<Promise<boolean>|null>(null),abort=useRef<AbortController|null>(null),closed=useRef(onClosed);
  useEffect(()=>{closed.current=onClosed;},[onClosed]);
  const persist=useCallback(()=>{
    if(!local.current||signedOut.current)return;
    try{writeAnswerBuffer(localStorage,userId,initial.id,currentVersion.current,values.current);}
    catch{if(alive.current)setError("Không lưu tạm được trên thiết bị này. Bản trên server vẫn được lưu khi có mạng.");}
  },[userId,initial.id]);
  const save=useCallback(async():Promise<boolean>=>{
    if(pending.current)return pending.current;
    if(blocked.current||signedOut.current)return false;
    if(!dirty.current)return true;
    const sent=values.current,sentSequence=sequence.current,sentVersion=currentVersion.current;
    const controller=new AbortController();abort.current=controller;setStatus("SAVING");const timeout=setTimeout(()=>controller.abort(),10000);
    pending.current=(async()=>{
      try{
        const result=savedAnswersDTOSchema.parse(await clientJSON(`/api/applications/${initial.id}/answers`,"PUT",{answer_version:sentVersion,answers:sent},{},controller.signal));
        if(!alive.current||signedOut.current)return false;
        currentVersion.current=result.answer_version;setVersion(result.answer_version);setSavedAt(result.saved_at);setError("");setClock(timerAnchor(result.server_now,result.deadline_at,performance.now()));
        dirty.current=sequence.current!==sentSequence;setStatus(dirty.current?"DIRTY":"SAVED");
        try{clearMatchingAnswerBuffers(localStorage,userId,initial.id,sent);}catch{/* Storage may be disabled. */}
        if(dirty.current)persist();return true;
      }catch(error){
        if(!alive.current||signedOut.current)return false;
        if(error instanceof ClientAPIError&&error.code==="ANSWER_VERSION_CONFLICT"){blocked.current=true;setStatus("CONFLICT");setError("Có bản mới hơn trên server. Thay đổi ở tab này chưa được ghi đè lên bản đó.");}
        else if(error instanceof ClientAPIError&&error.code==="INTERVIEW_CLOSED"){blocked.current=true;setStatus("CLOSED");setError(error.message);closed.current();}
        else if(error instanceof ClientAPIError&&error.status===413){blocked.current=true;setStatus("INVALID");setError("Tổng nội dung bài làm vượt giới hạn 100 KiB. Hãy rút gọn câu tự luận rồi lưu lại.");}
        else{setStatus("OFFLINE");setError(error instanceof Error?error.message:"Chưa đồng bộ được câu trả lời.");}
        persist();return false;
      }finally{clearTimeout(timeout);pending.current=null;abort.current=null;}
    })();return pending.current;
  },[initial.id,userId,persist]);
  useEffect(()=>{
    alive.current=true;let cancelled=false;
    queueMicrotask(()=>{if(cancelled)return;try{
      const buffer=readAnswerBuffer(localStorage,userId,initial.id);
      if(buffer&&initial.questions){validateAnswerIDs(buffer.answers,initial.questions);if(JSON.stringify(buffer.answers)===JSON.stringify(initial.answers))clearMatchingAnswerBuffers(localStorage,userId,initial.id,buffer.answers);
        else{setRecovery(buffer);blocked.current=true;local.current=true;setLocalEnabled(true);}}
    }catch{/* Malformed or unavailable local storage cannot change server answers. */}});
    return()=>{cancelled=true;alive.current=false;abort.current?.abort();};
  },[userId,initial.id,initial.questions,initial.answers]);
  useEffect(()=>{
    if(!dirty.current||blocked.current)return;
    const timer=setTimeout(()=>{void save();},1000);return()=>clearTimeout(timer);
  },[answers,version,save]);
  useEffect(()=>{
    const timer=setInterval(()=>{if(dirty.current&&!blocked.current)void save();},10000);
    const online=()=>{if(dirty.current&&!blocked.current)void save();};window.addEventListener("online",online);
    const warn=(event:BeforeUnloadEvent)=>{if(dirty.current){event.preventDefault();event.returnValue="";}};window.addEventListener("beforeunload",warn);
    return()=>{clearInterval(timer);window.removeEventListener("online",online);window.removeEventListener("beforeunload",warn);};
  },[save]);
  useEffect(()=>{
    function stop(){signedOut.current=true;blocked.current=true;dirty.current=false;local.current=false;abort.current?.abort();if(alive.current){setStatus("CLOSED");setError("Bạn đã đăng xuất. Hãy đăng nhập lại để tiếp tục; thời hạn bài thi không thay đổi.");}try{clearAnswerBuffers(localStorage,userId,initial.id);}catch{/* Storage unavailable. */}}
    window.addEventListener("loccv-signout",stop);let channel:BroadcastChannel|undefined;
    try{channel=new BroadcastChannel("loccv-auth");channel.onmessage=event=>{if(event.data==="SIGNED_OUT")stop();};}catch{/* No cross-tab API. */}
    return()=>{window.removeEventListener("loccv-signout",stop);channel?.close();};
  },[userId,initial.id]);
  useEffect(()=>{
    let disposed=false;
    async function resync(){
      if(pending.current)return;
      try{
        const next=interviewDTOSchema.parse(await clientJSON(`/api/applications/${initial.id}/interview`,"GET",undefined,{},AbortSignal.timeout(10000)));
        if(disposed||pending.current)return;
        if(next.state!=="IN_PROGRESS"){dirty.current=false;closed.current();return;}
        setClock(timerAnchor(next.server_now,next.deadline_at!,performance.now()));
        if(next.answer_version!==currentVersion.current){
          if(dirty.current||blocked.current){blocked.current=true;setStatus("CONFLICT");setError("Có bản mới hơn ở tab khác. Hãy tải bản trên server trước khi tiếp tục.");}
          else{values.current=next.answers!;currentVersion.current=next.answer_version;setAnswers(next.answers!);setVersion(next.answer_version);setSavedAt(next.saved_at);}
        }
      }catch{/* Keep local edits; the save state reports connectivity. */}
    }
    const focus=()=>{if(!document.hidden)void resync();};
    const timer=setInterval(()=>{void resync();},5000);window.addEventListener("focus",focus);document.addEventListener("visibilitychange",focus);void resync();
    return()=>{disposed=true;clearInterval(timer);window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",focus);};
  },[initial.id]);
  function change(next:CandidateAnswers){if(signedOut.current)return;if(status==="INVALID")blocked.current=false;values.current=candidateAnswersSchema.parse(next);setAnswers(values.current);sequence.current++;dirty.current=true;setStatus("DIRTY");persist();}
  async function flush(){for(let i=0;i<4&&dirty.current;i++)if(!await save())return false;return !dirty.current&&!blocked.current;}
  async function reloadServer(){
    try{
      const next=interviewDTOSchema.parse(await clientJSON(`/api/applications/${initial.id}/interview`,"GET"));
      if(next.state!=="IN_PROGRESS"){dirty.current=false;clearBuffer();closed.current();return;}
      values.current=next.answers!;currentVersion.current=next.answer_version;sequence.current++;dirty.current=false;blocked.current=false;
      setAnswers(values.current);setVersion(next.answer_version);setSavedAt(next.saved_at);setStatus("SAVED");setError("");setRecovery(null);setClock(timerAnchor(next.server_now,next.deadline_at!,performance.now()));clearBuffer();
    }catch(error){setError(error instanceof Error?error.message:"Chưa tải được bản trên server.");}
  }
  function clearBuffer(){try{clearAnswerBuffers(localStorage,userId,initial.id);}catch{/* Storage unavailable. */}}
  function restore(){
    if(!recovery||recovery.answer_version!==currentVersion.current)return;
    try{const next=validateAnswerIDs(recovery.answers,initial.questions!);blocked.current=false;setRecovery(null);change(next);}
    catch{setError("Bản tạm không khớp bài thi. Hãy dùng bản trên server.");}
  }
  function enableLocal(enabled:boolean){local.current=enabled;setLocalEnabled(enabled);if(enabled&&dirty.current)persist();if(!enabled)clearBuffer();}
  function lock(){blocked.current=true;}
  function complete(){dirty.current=false;blocked.current=true;clearBuffer();}
  const getVersion=()=>currentVersion.current;
  return {answers,version,savedAt,status,error,clock,recovery,localEnabled,change,flush,reloadServer,restore,enableLocal,clearBuffer,lock,complete,getVersion};
}
