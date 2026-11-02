import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "../src/lib/env.ts";
if(existsSync(".env.local"))process.loadEnvFile(".env.local");
try{
  const {url,secret}=getServerEnv();const client=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
  const [phase4,phase5,bucket]=await Promise.all([client.rpc("lc_due_interviews",{p_limit:1}),client.rpc("lc_operations",{}),client.storage.getBucket("cvs")]);
  const ready=!phase4.error&&!phase5.error&&!bucket.error&&bucket.data?.public===false;
  console.log(JSON.stringify({ok:ready,migration_0005:!phase4.error,migration_0006:!phase5.error,private_cv_bucket:!bucket.error&&bucket.data?.public===false,retention_enabled:process.env.DATA_RETENTION_ENABLED==="true"}));
  if(!ready){console.error("Chạy các migration còn thiếu theo thứ tự 0001 → 0006 trong Supabase SQL Editor, rồi chạy lại npm run phase5:check. Lệnh này chỉ đọc, không sửa hoặc xóa dữ liệu.");process.exitCode=2;}
}catch{console.error("Chưa kiểm tra được cấu hình Supabase/kết nối. Không in key hoặc dữ liệu hồ sơ.");process.exitCode=1;}
