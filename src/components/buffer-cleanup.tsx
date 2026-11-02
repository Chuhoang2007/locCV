"use client";
import { useEffect } from "react";
import { BUFFER_TTL_MS,bufferSchema } from "@/domain/answer-buffer";
export function BufferCleanup(){useEffect(()=>{const cleanup=()=>{try{for(const key of Object.keys(localStorage))if(key.startsWith("loccv-answers:")){const result=bufferSchema.safeParse(JSON.parse(localStorage.getItem(key)??"null"));if(!result.success||Date.now()-result.data.updated_at>=BUFFER_TTL_MS||result.data.updated_at>Date.now()+60000)localStorage.removeItem(key);}}catch{/* Storage may be disabled. */}};cleanup();const timer=setInterval(cleanup,60000);return()=>clearInterval(timer);},[]);return null;}
