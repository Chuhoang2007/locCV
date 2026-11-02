import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getServerEnv } from "../src/lib/env.js";
import type { Database } from "../src/lib/db.types.js";
const targetSchema=z.strictObject({kind:z.enum(["APPLICATION","UPLOAD"]),id:z.uuid(),storage_path:z.string().nullable()});
export type PurgeTarget=z.infer<typeof targetSchema>;
export interface PurgeStore{
  claim(retention:boolean):Promise<PurgeTarget[]>;
  removeFile(path:string):Promise<void>;
  finish(target:PurgeTarget):Promise<boolean>;
  deletionCandidates():Promise<string[]>;
  deleteAccount(id:string):Promise<void>;
}
export async function purgeData(store:PurgeStore,retention:boolean,signal?:AbortSignal,log:(value:{code:string;count?:number})=>void=()=>{}){
  let deleted=0,failed=0;
  for(const target of await store.claim(retention)){
    if(signal?.aborted)break;
    try{if(target.storage_path)await store.removeFile(target.storage_path);if(await store.finish(target))deleted++;}
    catch{failed++;log({code:"PURGE_RETRY_REQUIRED"});}
  }
  if(retention&&!signal?.aborted)for(const id of await store.deletionCandidates()){
    if(signal?.aborted)break;
    try{await store.deleteAccount(id);deleted++;}catch{failed++;log({code:"ACCOUNT_PURGE_RETRY_REQUIRED"});}
  }
  log({code:"PURGE_COMPLETED",count:deleted});return {deleted,failed};
}
export function createPurgeStore():PurgeStore{
  const {url,secret}=getServerEnv();const client=createClient<Database>(url,secret,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
  async function result<T>(query:PromiseLike<{data:T;error:unknown}>){const response=await query;if(response.error)throw new Error("PURGE_DATABASE_ERROR");return response.data;}
  return {
    async claim(retention){return z.array(targetSchema).parse(await result(client.rpc("lc_claim_purge",{p_limit:25,p_retention:retention})));},
    async removeFile(path){const {error}=await client.storage.from("cvs").remove([path]);if(error)throw new Error("PURGE_STORAGE_ERROR");},
    async finish(target){return (await result(client.rpc("lc_finish_purge",{p_kind:target.kind,p_id:target.id})))===true;},
    async deletionCandidates(){return z.array(z.uuid()).parse(await result(client.rpc("lc_deletion_candidates",{p_limit:10})));},
    async deleteAccount(id){const {error}=await client.auth.admin.deleteUser(id);if(error)throw new Error("PURGE_AUTH_ERROR");},
  };
}
