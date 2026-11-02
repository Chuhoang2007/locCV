"use client";
import { useEffect,useState } from "react";
import { taskDTOSchema,isTaskActive,type TaskDTO } from "@/domain/task";
export function useTask(initial:TaskDTO|null){
  const [task,setTask]=useState(initial);
  const [error,setError]=useState("");
  const taskId=task?.id;
  const active=task ? isTaskActive(task.state) : false;
  useEffect(()=>{
    if(!taskId || !active)return;
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;let failures=0;
    async function poll(){
      try{
        const response=await fetch(`/api/tasks/${taskId}`,{cache:"no-store",credentials:"same-origin",signal:controller.signal});
        if(!response.ok)throw new Error(response.status===401?"Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để xem kết quả.":"Chưa tải được tiến trình. Hệ thống sẽ tự kết nối lại.");
        const next=taskDTOSchema.parse(await response.json());
        if(controller.signal.aborted)return;
        setTask(next);setError("");failures=0;
        if(!isTaskActive(next.state))return;
      }catch(e){if(controller.signal.aborted)return;failures++;setError(e instanceof Error?e.message:"Chưa tải được tiến trình.");}
      timer=setTimeout(poll,document.hidden || failures>0?5000:2000);
    }
    timer=setTimeout(poll,500);
    return()=>{controller.abort();clearTimeout(timer);};
  },[taskId,active]);
  return {task,setTask,error};
}
