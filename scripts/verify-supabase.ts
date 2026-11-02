import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local", quiet: true });

const url = process.env.SUPABASE_TEST_URL;
const publicKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_TEST_SECRET_KEY;
if (!url || !publicKey || !secretKey) {
  console.log("Chưa chạy live test: cần SUPABASE_TEST_URL, SUPABASE_TEST_PUBLISHABLE_KEY và SUPABASE_TEST_SECRET_KEY của project TEST đã chạy migration.");
  process.exit(2);
}
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, options);
const ids: string[] = [];
try {
  const suffix = randomUUID();
  const password = randomUUID() + randomUUID();
  const accounts: {id:string;email:string}[] = [];
  for (const [prefix,name] of [["hr","HR kiểm thử"],["candidate","Ứng viên kiểm thử"]]) {
    const email = `${prefix}-${suffix}@example.test`;
    const { data,error } = await admin.auth.admin.createUser({ email,password,email_confirm:true,user_metadata:{display_name:name} });
    assert.ok(!error && data.user,"Admin Auth tạo fixture không thành công. Kiểm tra cấu hình project TEST.");
    ids.push(data.user.id); accounts.push({id:data.user.id,email});
  }
  const actor = createClient(url,publicKey,options);
  const { data:login,error:loginError } = await actor.auth.signInWithPassword({email:accounts[0].email,password});
  assert.ok(!loginError && login.user,"Không đăng nhập được fixture.");
  const id = login.user.id;
  const { data:profile,error:profileError } = await admin.from("users").select("id,preferred_mode").eq("id",id).single();
  assert.ok(!profileError && profile?.id === id,"Auth trigger chưa tạo profile.");
  for (const mode of ["HR","CANDIDATE"]) {
    const { data,error } = await admin.from("users").update({preferred_mode:mode}).eq("id",id).select("id,preferred_mode").single();
    assert.ok(!error && data.id === id && data.preferred_mode === mode,"Đổi mode không đúng.");
  }
  for (const client of [actor,createClient(url,publicKey,options)]) {
    for (const table of ["users","jobs","applications","messages","ai_tasks","idempotency_keys","audit_events"]) {
      const { data,error } = await client.from(table).select("*").limit(1);
      assert.ok(error || data?.length === 0,`Rò rỉ quyền đọc trực tiếp bảng ${table}.`);
    }
  }
  const { error:signoutError } = await actor.auth.signOut();
  assert.ok(!signoutError,"Đăng xuất không thành công.");
  const { data:after } = await actor.auth.getUser();
  assert.equal(after.user,null);
  console.log("PASS live Supabase: Auth signup fixture/login/logout, profile trigger, hai mode cùng UUID, quyền đọc trực tiếp bị chặn.");
} catch {
  console.error("Live test chưa đạt. Kiểm tra cấu hình Auth, hai migration và policy trên project TEST. Không in lỗi provider hoặc secret.");
  process.exitCode = 1;
} finally {
  // Chỉ xóa ID vừa được script tạo trong lượt này, không đụng tài khoản có sẵn.
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) { console.error("Chưa dọn được một fixture vừa tạo; kiểm tra Auth của project TEST."); process.exitCode = 1; }
  }
}
