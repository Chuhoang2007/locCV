import { requireApiViewer } from "@/server/auth";
import { assertSameOrigin,errorResponse,privateJSON,readJSON } from "@/server/http";
import { createJob,listHRJobs } from "@/server/dal/jobs";
import { idempotencyKey } from "@/server/idempotency";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  try{const viewer=await requireApiViewer();return privateJSON(await listHRJobs(viewer.id,Object.fromEntries(new URL(request.url).searchParams)));}
  catch(error){return errorResponse(error);}
}
export async function POST(request:Request){
  try{assertSameOrigin(request);const viewer=await requireApiViewer();return privateJSON(await createJob(viewer.id,await readJSON(request,65536),idempotencyKey(request)),201);}
  catch(error){return errorResponse(error);}
}
