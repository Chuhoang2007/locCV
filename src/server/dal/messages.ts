import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { decisionSchema,messageCardSchema,messageDetailSchema,deletionStatusSchema } from "@/domain/messages";
import { decodeCursor,encodeCursor } from "@/domain/jobs";
import { jobId,parseInput } from "./jobs";
import { dbResult } from "../rpc";

export async function decideApplication(actor:string,id:string,value:unknown){
  const input=parseInput(decisionSchema,value);
  return dbResult(createAdminClient().rpc("lc_decide_application",{p_actor:actor,p_application:jobId(id),p_version:input.expected_version,p_decision:input.decision,p_message:input.message}));
}
export async function listInbox(actor:string,value:unknown){
  const filter=parseInput(z.object({cursor:z.string().max(400).optional(),limit:z.coerce.number().int().min(1).max(50).default(20),unread:z.enum(["true","false"]).default("false")}),value);
  const before=filter.cursor?decodeCursor(filter.cursor):null;
  const data=z.object({items:z.array(messageCardSchema),unread_count:z.number().int().nonnegative()}).parse(await dbResult(createAdminClient().rpc("lc_inbox",{p_actor:actor,p_before_time:before?.time??null,p_before_id:before?.id??null,p_limit:filter.limit,p_unread:filter.unread==="true"})));
  const items=data.items.slice(0,filter.limit),last=items.at(-1);
  return {items,unread_count:data.unread_count,next_cursor:data.items.length>filter.limit&&last?encodeCursor(last.created_at,last.id):null};
}
export async function getMessage(actor:string,id:string,read=false){
  return messageDetailSchema.parse(await dbResult(createAdminClient().rpc("lc_message",{p_actor:actor,p_message:jobId(id),p_read:read})));
}
export async function deletionStatus(actor:string){
  const data=await dbResult(createAdminClient().from("users").select("deletion_requested_at").eq("id",actor).single());
  const stamp=data.deletion_requested_at;
  return deletionStatusSchema.parse({requested_at:stamp,scheduled_at:stamp?new Date(new Date(stamp).getTime()+7*86400000).toISOString():null});
}
export async function requestDeletion(actor:string,value:unknown){
  const input=parseInput(z.strictObject({requested:z.boolean()}),value);
  return deletionStatusSchema.parse(await dbResult(createAdminClient().rpc("lc_deletion_request",{p_actor:actor,p_requested:input.requested})));
}
