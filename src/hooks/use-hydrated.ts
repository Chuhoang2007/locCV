"use client";
import { useSyncExternalStore } from "react";
const subscribe=()=>()=>{};
// Server-rendered file inputs must wait until their change handler can receive files.
export function useHydrated(){return useSyncExternalStore(subscribe,()=>true,()=>false);}
