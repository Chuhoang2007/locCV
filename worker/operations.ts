import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../src/lib/db.types.js";
import { getServerEnv } from "../src/lib/env.js";
export const operationsSchema=z.strictObject({schema_version:z.literal(6),queued:z.number().nonnegative(),running:z.number().nonnegative(),oldest_queue_seconds:z.number().nonnegative(),retries_24h:z.number().nonnegative(),failed_24h:z.number().nonnegative(),timeout_24h:z.number().nonnegative(),invalid_json_24h:z.number().nonnegative(),autosubmit_lag_seconds:z.number().nonnegative(),purge_pending:z.number().nonnegative()});
export async function readOperations(){const {url,secret}=getServerEnv();const client=createClient<Database>(url,secret,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});const {data,error}=await client.rpc("lc_operations",{});if(error)throw new Error("OPERATIONS_UNAVAILABLE");return operationsSchema.parse(data);}
