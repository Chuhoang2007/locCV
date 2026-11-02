"use client";
import { useEffect,useState } from "react";
import { usePathname } from "next/navigation";
import { clientJSON } from "@/lib/client-api";
export function InboxBadge(){const [count,setCount]=useState(0);const path=usePathname();useEffect(()=>{let active=true;const poll=async()=>{try{const data=await clientJSON<{unread_count:number}>("/api/inbox?limit=1","GET");if(active)setCount(data.unread_count);}catch{/* The Inbox page provides recovery; preserve the last known badge. */}};void poll();const timer=setInterval(()=>{if(document.visibilityState==="visible")void poll();},30000);window.addEventListener("loccv-inbox-read",poll);return()=>{active=false;clearInterval(timer);window.removeEventListener("loccv-inbox-read",poll);};},[path]);return count>0?<span className="inbox-badge" aria-label={`${count} thông báo chưa đọc`}>{count>99?"99+":count}</span>:null;}
