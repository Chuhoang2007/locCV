"use client";
import { createContext,useContext } from "react";
import { Input } from "./ui/input";
export const EditorValidationContext=createContext<Record<string,string>>({});
function useField(id:string|undefined){const errors=useContext(EditorValidationContext);return id?errors[id]:undefined;}
function Message({id,message}:{id?:string;message?:string}){return message?<p id={`${id}-error`} className="field-error">{message}</p>:null;}
export function EditorInput(props:React.ComponentProps<"input">){const message=useField(props.id);return <><Input {...props} aria-invalid={message?true:props["aria-invalid"]} aria-describedby={message?`${props.id}-error`:props["aria-describedby"]}/><Message id={props.id} message={message}/></>;}
export function EditorTextarea(props:React.ComponentProps<"textarea">){const message=useField(props.id);return <><textarea {...props} aria-invalid={message?true:undefined} aria-describedby={message?`${props.id}-error`:props["aria-describedby"]}/><Message id={props.id} message={message}/></>;}
export function EditorSelect(props:React.ComponentProps<"select">){const message=useField(props.id);return <><select {...props} aria-invalid={message?true:undefined} aria-describedby={message?`${props.id}-error`:props["aria-describedby"]}/><Message id={props.id} message={message}/></>;}
export function EditorGroupError({id}:{id:string}){const message=useField(id);return <Message id={id} message={message}/>;}
