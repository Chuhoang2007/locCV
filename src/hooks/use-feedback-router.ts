"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useNavigationFeedback } from "@/components/navigation-feedback";

export function useFeedbackRouter(){
  const router=useRouter(),feedback=useNavigationFeedback();
  return useMemo(()=>{
    const transition=(action:()=>void)=>feedback?feedback.transition(action):action();
    return {...router,
      push:(...args:Parameters<typeof router.push>)=>transition(()=>router.push(...args)),
      replace:(...args:Parameters<typeof router.replace>)=>transition(()=>router.replace(...args)),
      refresh:()=>transition(()=>router.refresh()),
    };
  },[router,feedback]);
}
