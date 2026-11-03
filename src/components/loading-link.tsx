"use client";
import NextLink,{useLinkStatus} from "next/link";
import { useEffect,useId,type ComponentProps } from "react";
import { useNavigationFeedback } from "./navigation-feedback";

function LinkPending(){
  const {pending}=useLinkStatus();const id=useId();const feedback=useNavigationFeedback();
  useEffect(()=>{feedback?.report(id,pending);return()=>feedback?.report(id,false);},[feedback,id,pending]);
  return null;
}
export default function LoadingLink({children,...props}:ComponentProps<typeof NextLink>){
  return <NextLink {...props}>{children}<LinkPending/></NextLink>;
}
