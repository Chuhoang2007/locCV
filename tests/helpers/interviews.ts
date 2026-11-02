import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import fixture from "../fixtures/generated-job.json";
import { applyArgs,candidate,cvReport,publishedJob } from "./applications";
import { pgQueue,sqlRPC } from "./queue";
export const essayText="Tôi kiểm tra schema trước xử lý. Tôi bắt lỗi và che dữ liệu riêng.";
export const interviewAnswers={quiz:fixture.interview_questions.quiz.map(q=>({question_id:q.id,selected_answer:"a"})),essay:[{question_id:"e_api",text:essayText}]};
export async function readyApplication(db:PGlite,policy="CV_THRESHOLD",score=60){
  const job=await publishedJob(db,policy);const {application_id}=await sqlRPC<{application_id:string}>(db,"lc_apply",applyArgs(job));const lease=randomUUID(),queue=pgQueue(db),task=await queue.claim(lease);await queue.completeCV(task!.id,lease,cvReport(score));return application_id;
}
export async function start(db:PGlite,id:string){return sqlRPC<{deadline_at:string;started_at:string;answer_version:number}>(db,"lc_start_interview",{p_actor:candidate,p_application:id});}
export async function save(db:PGlite,id:string,version=0,answers:unknown=interviewAnswers){return sqlRPC<{answer_version:number}>(db,"lc_save_answers",{p_actor:candidate,p_application:id,p_version:version,p_answers:answers});}
// Test-only clock fixture: never exposed by production source or migrations.
export async function expireFixture(db:PGlite,id:string){
  await db.exec("alter table public.applications disable trigger applications_guard");
  try{await db.query("update public.applications set interview_started_at=interview_started_at-interval '3 hours',interview_deadline_at=interview_deadline_at-interval '3 hours' where id=$1",[id]);}
  finally{await db.exec("alter table public.applications enable trigger applications_guard");}
}
export function rawEssay(){return {questions:[{question_id:"e_api",criteria:[{criterion_id:"validation",score:6,evidence:["kiểm tra schema"],feedback:"Có kiểm tra runtime."},{criterion_id:"errors",score:2,evidence:["bắt lỗi"],feedback:"Có xử lý lỗi."}],feedback:"Có bằng chứng từ câu trả lời."}],summary:"Đánh giá tự luận từ dữ liệu kiểm thử."};}
