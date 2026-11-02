import { randomUUID } from "node:crypto";
import { beforeEach,afterEach,describe,it,expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../helpers/database";
import { sqlRPC } from "../helpers/queue";
import { applyArgs,candidate,hr,publishedJob } from "../helpers/applications";
import { syntheticCV } from "../helpers/cv-fixtures";
let db:PGlite;const other="33333333-3333-4333-8333-333333333333";
beforeEach(async()=>{db=await createTestDatabase();await db.query("insert into auth.users(id) values($1)",[other]);});afterEach(async()=>{await db.close();});
describe("CV ownership, storage and task boundaries",()=>{
  it("isolates temporary uploads, consumes them once and checks confirmed text",async()=>{
    const id=randomUUID();const path=await sqlRPC<string>(db,"lc_reserve_cv_upload",{p_actor:candidate,p_id:id,p_source:"DOCX"});expect(path).toMatch(new RegExp('^'+candidate+'/'));
    await expect(sqlRPC(db,"lc_begin_cv_extraction",{p_actor:other,p_upload:id,p_token:randomUUID()})).rejects.toThrow("NOT_FOUND");
    const token=randomUUID();await sqlRPC(db,"lc_begin_cv_extraction",{p_actor:candidate,p_upload:id,p_token:token});
    expect(await sqlRPC(db,"lc_finish_cv_extraction",{p_actor:candidate,p_upload:id,p_token:randomUUID(),p_text:syntheticCV})).toBe(false);
    expect(await sqlRPC(db,"lc_finish_cv_extraction",{p_actor:candidate,p_upload:id,p_token:token,p_text:syntheticCV})).toBe(true);
    const job=await publishedJob(db);await expect(sqlRPC(db,"lc_apply",applyArgs(job,{p_source:"DOCX",p_upload:id,p_text:syntheticCV+"changed"}))).rejects.toThrow("CV_TEXT_CHANGED");
    await expect(sqlRPC(db,"lc_apply",applyArgs(job,{p_actor:other,p_source:"DOCX",p_upload:id}))).rejects.toThrow("NOT_FOUND");
    const applied=await sqlRPC<{application_id:string}>(db,"lc_apply",applyArgs(job,{p_source:"DOCX",p_upload:id}));
    await expect(sqlRPC(db,"lc_cv_download",{p_actor:other,p_application:applied.application_id})).rejects.toThrow("NOT_FOUND");
    for(const actor of [candidate,hr])expect(await sqlRPC(db,"lc_cv_download",{p_actor:actor,p_application:applied.application_id})).toMatchObject({path,source:"DOCX"});
    expect((await db.query("select id from public.audit_events where event_type='CV_DOWNLOAD_LINK_REQUESTED'")).rows).toHaveLength(2);
    await expect(sqlRPC(db,"lc_apply",applyArgs(await publishedJob(db),{p_source:"DOCX",p_upload:id}))).rejects.toThrow("CV_UPLOAD_EXPIRED");
  });
  it("expires temporary uploads and enforces ten uploads per hour",async()=>{
    const id=randomUUID();await sqlRPC(db,"lc_reserve_cv_upload",{p_actor:candidate,p_id:id,p_source:"PDF"});
    await db.query("update public.cv_uploads set expires_at=now()-interval '1 second' where id=$1",[id]);
    await expect(sqlRPC(db,"lc_begin_cv_extraction",{p_actor:candidate,p_upload:id,p_token:randomUUID()})).rejects.toThrow("CV_UPLOAD_EXPIRED");
    for(let i=1;i<10;i++)await sqlRPC(db,"lc_reserve_cv_upload",{p_actor:candidate,p_id:randomUUID(),p_source:"PDF"});
    await expect(sqlRPC(db,"lc_reserve_cv_upload",{p_actor:candidate,p_id:randomUUID(),p_source:"PDF"})).rejects.toThrow("CV_RATE_LIMITED");
  });
  it("candidate and owning HR receive only safe task DTOs; others receive nothing",async()=>{
    const job=await publishedJob(db);const {application_id}=await sqlRPC<{application_id:string}>(db,"lc_apply",applyArgs(job));
    for(const actor of [hr,candidate]){
      const task=await sqlRPC(db,"lc_application_task",{p_actor:actor,p_application:application_id});expect(task).toBeTruthy();expect(JSON.stringify(task)).not.toMatch(/cv_text|job_snapshot|scoring_guidance|correct_answer|storage_path|requested_by/);
    }
    expect(await sqlRPC(db,"lc_application_task",{p_actor:other,p_application:application_id})).toBeNull();
    await expect(sqlRPC(db,"lc_list_applications",{p_actor:other,p_job:job,p_status:null,p_before_time:null,p_before_id:null,p_limit:20})).rejects.toThrow("NOT_FOUND");
    expect(await sqlRPC(db,"lc_list_applications",{p_actor:other,p_job:null,p_status:null,p_before_time:null,p_before_id:null,p_limit:20})).toEqual([]);
    for(const role of ["anon","authenticated"]){
      await db.exec(`set role ${role}`);
      try{await expect(db.query("select * from public.cv_uploads")).rejects.toThrow(/permission denied/);await expect(sqlRPC(db,"lc_application_task",{p_actor:hr,p_application:application_id})).rejects.toThrow(/permission denied/);}
      finally{await db.exec("reset role");}
    }
  });
});
