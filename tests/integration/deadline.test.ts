import { beforeEach,afterEach,describe,it,expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../helpers/database";
import { pgQueue } from "../helpers/queue";
import { candidate } from "../helpers/applications";
import { readyApplication,start,save,expireFixture } from "../helpers/interviews";
import { submitPersistedInterview } from "@/server/interview-submission";
import { expireInterviews } from "../../worker/expire-interviews";
let db:PGlite;
beforeEach(async()=>{db=await createTestDatabase();});afterEach(async()=>{await db.close();});
describe("Server deadline and timeout recovery",()=>{
  it("only ALWAYS allows a below-threshold CV; no mode or clock reset changes a deadline",async()=>{
    const locked=await readyApplication(db,"CV_THRESHOLD",59);await expect(start(db,locked)).rejects.toThrow("INTERVIEW_NOT_ELIGIBLE");
    const allowed=await readyApplication(db,"ALWAYS",59);const first=await start(db,allowed);await db.query("update public.users set preferred_mode='HR' where id=$1",[candidate]);expect((await start(db,allowed)).deadline_at).toBe(first.deadline_at);
    await expect(db.query("update public.applications set interview_deadline_at=interview_deadline_at+interval '1 minute' where id=$1",[allowed])).rejects.toThrow("IMMUTABLE_INTERVIEW_DEADLINE");
  });
  it("late saves fail; manual submit racing timeout sweep freezes only pre-deadline answers",async()=>{
    const id=await readyApplication(db);await start(db,id);await save(db,id);await expireFixture(db,id);
    await expect(save(db,id,1,{quiz:[],essay:[]})).rejects.toThrow("INTERVIEW_CLOSED");
    await Promise.all([submitPersistedInterview(pgQueue(db),candidate,id,"fixture",false,1),expireInterviews(pgQueue(db),"fixture")]);
    const app=(await db.query<{submission_reason:string;quiz_result_json:{score:number};answer_version:number}>("select submission_reason,quiz_result_json,answer_version from public.applications where id=$1",[id])).rows[0];expect(app.submission_reason).toBe("TIMEOUT");expect(app.quiz_result_json.score).toBe(100);expect(app.answer_version).toBe(1);
    expect((await db.query("select id from public.ai_tasks where kind='EVALUATE_ESSAY'")).rows).toHaveLength(1);expect((await db.query("select id from public.messages where kind='INTERVIEW_SUBMITTED'")).rows).toHaveLength(1);
    expect(await expireInterviews(pgQueue(db),"fixture")).toBe(0);
  });
  it("worker recovery submits an unanswered expired exam without a browser or network call to grade quiz",async()=>{
    const id=await readyApplication(db);await start(db,id);await expireFixture(db,id);expect(await expireInterviews(pgQueue(db),"fixture")).toBe(1);
    const app=(await db.query<{quiz_result_json:{score:number;questions:{selected_answer:null}[]};interview_score:null}>("select quiz_result_json,interview_score from public.applications where id=$1",[id])).rows[0];expect(app.quiz_result_json.score).toBe(0);expect(app.quiz_result_json.questions.every(q=>q.selected_answer===null)).toBe(true);expect(app.interview_score).toBeNull();
  });
});
