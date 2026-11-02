import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "../src/lib/env.ts";
if(existsSync(".env.local"))process.loadEnvFile(".env.local");
try{
  const {url,secret}=getServerEnv();const client=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
  const previous=await client.from("cv_uploads").select("id").limit(0);
  const current=await client.rpc("lc_due_interviews",{p_limit:1});
  const bucket=await client.storage.getBucket("cvs");
  const phase3Ready=!previous.error,phase4Ready=!current.error,storageReady=!bucket.error&&bucket.data?.public===false;
  console.log(JSON.stringify({ok:phase3Ready&&phase4Ready&&storageReady,migration_0004:phase3Ready,migration_0005:phase4Ready,private_cv_bucket:storageReady}));
  if(!phase3Ready){console.error("Chưa có migration 0004. Chạy supabase/migrations/0004_application_transactions.sql trước.");process.exitCode=2;}
  if(!phase4Ready){console.error("Chưa có migration Phase 4. Chạy supabase/migrations/0005_interview_and_inbox_transactions.sql, rồi chạy lại npm run phase4:check.");process.exitCode=2;}
  if(!storageReady){console.error("Bucket CV chưa private/sẵn sàng. Kiểm tra migration 0002 và quyền server.");process.exitCode=2;}
}catch{console.error("Chưa kiểm tra được Phase 4. Kiểm tra ba biến Supabase ở đầu .env.local và kết nối mạng. Không in key hoặc nội dung hồ sơ.");process.exitCode=1;}
