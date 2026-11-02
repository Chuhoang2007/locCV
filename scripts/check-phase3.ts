import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "../src/lib/env.ts";
if(existsSync(".env.local"))process.loadEnvFile(".env.local");
try{
  const {url,secret}=getServerEnv();
  const client=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
  const table=await client.from("cv_uploads").select("id").limit(0);
  const rpc=await client.rpc("lc_application_task",{p_actor:randomUUID(),p_application:randomUUID()});
  const bucket=await client.storage.getBucket("cvs");
  const migrationReady=!table.error&&!rpc.error;
  const privateStorageReady=!bucket.error&&bucket.data?.public===false&&bucket.data.file_size_limit===5242880;
  console.log(JSON.stringify({ok:migrationReady&&privateStorageReady,migration_0004:migrationReady,private_cv_bucket:privateStorageReady}));
  if(!migrationReady){console.error("Chưa có migration Phase 3. Chạy supabase/migrations/0004_application_transactions.sql trong Supabase SQL Editor, sau đó chạy lại npm run phase3:check.");process.exitCode=2;}
  if(!privateStorageReady){console.error("Bucket cvs chưa sẵn sàng. Kiểm tra migration 0002 và quyền server Storage.");process.exitCode=2;}
}catch{console.error("Chưa kiểm tra được Phase 3. Kiểm tra ba biến Supabase ở đầu .env.local và kết nối mạng. Không in key hoặc dữ liệu CV.");process.exitCode=1;}
