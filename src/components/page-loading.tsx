"use client";
import { useEffect,useId } from "react";
import { useNavigationFeedback } from "./navigation-feedback";

export function PageLoading({fullPage=false}:{fullPage?:boolean}){
  const id=useId(),feedback=useNavigationFeedback();
  useEffect(()=>{feedback?.report(id,true);return()=>feedback?.report(id,false);},[feedback,id]);
  return <section className={`page-loading${fullPage?" page-loading-full":""}`} aria-label="Đang tải trang" aria-busy="true" data-testid="page-loading">
    <p className="loading-description">Đang tải nội dung…</p>
    <div className="loading-skeleton" aria-hidden="true"><div className="loading-heading"><span/><span/></div>
      {[0,1,2].map(row=><div className="loading-row" key={row}><span/><span/><span/></div>)}
    </div>
  </section>;
}
