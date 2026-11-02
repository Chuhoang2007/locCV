import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbResult } from "@/server/rpc";
export async function ApplicationSummary({actor,job=null}:{actor:string;job?:string|null}){
  const summary=z.object({total:z.number(),pending:z.number(),evaluated:z.number(),decided:z.number()}).parse(await dbResult(createAdminClient().rpc("lc_hr_summary",{p_actor:actor,p_job:job})));
  return <dl className="application-summary" aria-label="Tổng quan hồ sơ">{([["total","Tổng hồ sơ"],["pending","Đang xử lý"],["evaluated","Chờ HR phản hồi"],["decided","Đã quyết định"]] as const).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{summary[key]}</dd></div>)}</dl>;
}
