"use client";
import { createContext,useCallback,useContext,useMemo,useState,useTransition } from "react";
import { LoaderCircle } from "lucide-react";

type FeedbackAPI={report:(id:string,pending:boolean)=>void;transition:(action:()=>void)=>void};
const FeedbackContext=createContext<FeedbackAPI|null>(null);
const RoutePendingContext=createContext(false);
export function useNavigationFeedback(){return useContext(FeedbackContext);}
export function useRoutePending(){return useContext(RoutePendingContext);}

export function NavigationFeedback({children}:{children:React.ReactNode}){
  const [links,setLinks]=useState<Set<string>>(()=>new Set());
  const [routePending,startTransition]=useTransition();
  const report=useCallback((id:string,pending:boolean)=>{setLinks(previous=>{
    if(previous.has(id)===pending)return previous;
    const next=new Set(previous);if(pending)next.add(id);else next.delete(id);return next;
  });},[]);
  const transition=useCallback((action:()=>void)=>startTransition(action),[startTransition]);
  const value=useMemo(()=>({report,transition}),[report,transition]);
  const pending=routePending||links.size>0;
  return <FeedbackContext.Provider value={value}><RoutePendingContext.Provider value={routePending}>
    {children}
    {pending&&<div className="navigation-feedback" data-testid="navigation-feedback">
      <div className="navigation-progress" aria-hidden="true"><span/></div>
      <div className="navigation-status" role="status" aria-live="polite"><LoaderCircle size={17} className="spin" aria-hidden="true"/><span>Đang tải nội dung…</span></div>
    </div>}
  </RoutePendingContext.Provider></FeedbackContext.Provider>;
}
