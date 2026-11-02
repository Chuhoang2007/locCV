import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../helpers/database";

const hr="11111111-1111-4111-8111-111111111111";
const candidate="22222222-2222-4222-8222-222222222222";
let db: PGlite;
let jobId: string;
let applicationId: string;

async function insertApplication(userId: string, target = jobId) {
  return db.query<{id:string}>(`insert into public.applications(job_id,candidate_user_id,job_snapshot_json,cv_source,cv_sha256,cv_text,ai_processing_acknowledged_at)
    values ($1,$2,'{}','TEXT',$3,$4,now()) returning id`,[target,userId,"a".repeat(64),"Nội dung CV dùng để kiểm thử migration và phân quyền, không phải dữ liệu cá nhân. ".repeat(3)]);
}

beforeAll(async()=>{
  db=await createTestDatabase(true, 1);
  jobId=(await db.query<{id:string}>("insert into public.jobs(owner_user_id) values ($1) returning id",[hr])).rows[0].id;
  await db.query(`update public.jobs set status='PUBLISHED',title='TypeScript Developer',jd_json='{"title":"TypeScript Developer"}',
    scoring_rubric_json='{"schema_version":1,"pass_threshold":60,"criteria":[]}',
    interview_questions_json='{"schema_version":1,"duration_minutes":30,"quiz":[],"essay":[]}',
    approved_by_user_id=$1,published_at=now() where id=$2`,[hr,jobId]);
});
afterAll(async()=>{ await db?.close(); });

describe("Migration PostgreSQL thật với schema Auth/Storage giả lập",()=>{
  it("tạo đủ bảy bảng và hai profile qua auth trigger",async()=>{
    const tables=await db.query<{table_name:string}>("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'");
    expect(tables.rows).toHaveLength(7);
    const result=await db.query<{id:string;preferred_mode:string}>("select id,preferred_mode from public.users order by id");
    expect(result.rows).toEqual([{id:hr,preferred_mode:"HR"},{id:candidate,preferred_mode:"CANDIDATE"}]);
  });
  it("đổi mode giữ nguyên danh tính",async()=>{
    const before=(await db.query<{id:string;created_at:string}>("select id,created_at from public.users where id=$1",[candidate])).rows[0];
    await db.query("update public.users set preferred_mode='HR' where id=$1",[candidate]);
    const after=(await db.query<{id:string;created_at:string}>("select id,created_at from public.users where id=$1",[candidate])).rows[0];
    expect(after).toEqual(before);
  });
  it("không nhận quyền/mode từ metadata lúc đăng ký",async()=>{
    const id="33333333-3333-4333-8333-333333333333";
    await db.query(`insert into auth.users(id,raw_user_meta_data) values ($1,'{"display_name":"C","preferred_mode":"HR","role":"admin"}')`,[id]);
    const row=(await db.query<{preferred_mode:string}>("select preferred_mode from public.users where id=$1",[id])).rows[0];
    expect(row.preferred_mode).toBe("CANDIDATE");
  });
  it("profile cấm tên trắng, mode giả và timezone không tồn tại",async()=>{
    await expect(db.query("update public.users set display_name='  ' where id=$1",[candidate])).rejects.toThrow();
    await expect(db.query("update public.users set preferred_mode='ADMIN' where id=$1",[candidate])).rejects.toThrow();
    await expect(db.query("update public.users set timezone='Imaginary/Zone' where id=$1",[candidate])).rejects.toThrow("INVALID_TIMEZONE");
  });
  it("anon và authenticated không SELECT/INSERT/UPDATE/DELETE trực tiếp bảng riêng",async()=>{
    for(const role of ["anon","authenticated"]){
      await db.exec(`set role ${role}`);
      try{
        for(const table of ["users","jobs","applications","messages","ai_tasks","idempotency_keys","audit_events"]){
          await expect(db.query(`select * from public.${table}`)).rejects.toThrow(/permission denied/);
        }
        await expect(db.query("update public.users set preferred_mode='HR'")).rejects.toThrow(/permission denied/);
        await expect(db.query("delete from public.jobs")).rejects.toThrow(/permission denied/);
        await expect(db.query("insert into public.jobs(owner_user_id) values ($1)",[candidate])).rejects.toThrow(/permission denied/);
      }finally{await db.exec("reset role");}
    }
  });
  it("RLS vẫn chặn nếu vô tình grant SELECT một bảng",async()=>{
    await db.exec("grant select on public.users to authenticated; set role authenticated;");
    try{expect((await db.query("select * from public.users")).rows).toHaveLength(0);}
    finally{await db.exec("reset role; revoke select on public.users from authenticated;");}
  });
  it("server service role đọc được profile, không được sửa/xóa audit",async()=>{
    await db.exec("set role service_role");
    try{
      expect((await db.query("select id from public.users where id=$1",[candidate])).rows).toHaveLength(1);
      await expect(db.query("delete from public.audit_events")).rejects.toThrow(/permission denied/);
    }finally{await db.exec("reset role");}
  });
  it("bucket cvs private có giới hạn file 5 MiB",async()=>{
    const row=(await db.query<{public:boolean;file_size_limit:number}>("select public,file_size_limit from storage.buckets where id='cvs'")).rows[0];
    expect(row.public).toBe(false);expect(Number(row.file_size_limit)).toBe(5242880);
  });
  it("policy restrictive giữ CV riêng dù có policy permissive rộng",async()=>{
    await db.exec(`insert into storage.objects(bucket_id,name) values ('cvs','private.pdf'); create policy broad_test on storage.objects for all to authenticated using (true) with check (true); set role authenticated;`);
    try{
      expect((await db.query("select * from storage.objects where bucket_id='cvs'")).rows).toHaveLength(0);
      await expect(db.query("insert into storage.objects(bucket_id,name) values ('cvs','forbidden.pdf')")).rejects.toThrow(/row-level security/);
      expect((await db.query("delete from storage.objects where bucket_id='cvs' returning id")).rows).toHaveLength(0);
    }finally{await db.exec("reset role; drop policy broad_test on storage.objects;");}
  });
  it("trigger chặn self-apply cả khi tài khoản đổi sang CANDIDATE",async()=>{
    await db.query("update public.users set preferred_mode='CANDIDATE' where id=$1",[hr]);
    await expect(insertApplication(hr)).rejects.toThrow("SELF_APPLICATION");
  });
  it("snapshot do DB lấy từ tin, không tin input giả",async()=>{
    applicationId=(await insertApplication(candidate)).rows[0].id;
    const row=(await db.query<{job_snapshot_json:{job_id:string;scoring_rubric:{pass_threshold:number}}}>("select job_snapshot_json from public.applications where id=$1",[applicationId])).rows[0];
    expect(row.job_snapshot_json.job_id).toBe(jobId);
    expect(row.job_snapshot_json.scoring_rubric.pass_threshold).toBe(60);
  });
  it("unique ngăn hồ sơ trùng và FK ngăn user giả",async()=>{
    await expect(insertApplication(candidate)).rejects.toThrow(/unique constraint/);
    await expect(insertApplication("44444444-4444-4444-8444-444444444444")).rejects.toThrow(/foreign key/);
  });
  it("khóa CV/snapshot sau khi tiếp nhận",async()=>{
    await expect(db.query("update public.applications set cv_text=$1 where id=$2",["CV thay đổi sau tiếp nhận ".repeat(6),applicationId])).rejects.toThrow("IMMUTABLE_APPLICATION_INPUT");
  });
  it("không nhảy thẳng hồ sơ thành HR_APPROVED",async()=>{
    await expect(db.query("update public.applications set status='HR_APPROVED' where id=$1",[applicationId])).rejects.toThrow("INVALID_APPLICATION_TRANSITION");
  });
  it("cấu hình tin đã đăng là bất biến; đóng tin không nhận hồ sơ mới",async()=>{
    await expect(db.query("update public.jobs set title='Changed' where id=$1",[jobId])).rejects.toThrow("PUBLISHED_JOB_IS_IMMUTABLE");
    await db.query("update public.jobs set status='CLOSED',closed_at=now() where id=$1",[jobId]);
    await expect(insertApplication("33333333-3333-4333-8333-333333333333")).rejects.toThrow("JOB_NOT_OPEN");
  });
  it("browser không gọi được SECURITY DEFINER profile trigger",async()=>{
    const result=await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','public.handle_new_auth_user()','execute') as allowed");
    expect(result.rows[0].allowed).toBe(false);
  });
});
