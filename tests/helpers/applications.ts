import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import fixture from "../fixtures/generated-job.json";
import { sqlRPC } from "./queue";
import { syntheticCV } from "./cv-fixtures";
export const hr="11111111-1111-4111-8111-111111111111",candidate="22222222-2222-4222-8222-222222222222",hash="a".repeat(64);
export async function publishedJob(db:PGlite,policy="CV_THRESHOLD"){
  const {job_id}=await sqlRPC<{job_id:string}>(db,"lc_create_job",{p_actor:hr,p_prompt:"Synthetic job for CV tests",p_generate:false,p_key:randomUUID(),p_hash:hash,p_model:"fixture",p_prompt_version:"recruitment-v1"});
  await sqlRPC(db,"lc_save_job",{p_actor:hr,p_job:job_id,p_version:1,p_draft:{...fixture,interview_access_policy:policy}});
  await sqlRPC(db,"lc_publish_job",{p_actor:hr,p_job:job_id,p_version:2});return job_id;
}
export function applyArgs(job:string,overrides:Record<string,unknown>={}){return {p_actor:candidate,p_job:job,p_source:"TEXT",p_upload:null,p_text:syntheticCV,p_ack:true,p_key:randomUUID(),p_hash:hash,p_model:"fixture",p_prompt_version:"recruitment-v1",...overrides};}
export function cvReport(score=60){return {schema_version:1,criteria:fixture.scoring_rubric.criteria.map((c,i)=>({criterion_id:c.id,max_points:c.max_points,score:i===0?score:0,evidence:i===0&&score>0?["Developed TypeScript"]:[],missing_evidence:[],feedback:"Synthetic assessment based on supplied evidence."})),total_score:score,pass_threshold:60,passed:score>=60,summary:"Synthetic summary for test data."};}
