import { requireApiViewer } from "@/server/auth";
import { assertSameOrigin,errorResponse,privateJSON,readJSON } from "@/server/http";
import { applyToJob,listApplications } from "@/server/dal/applications";
import { idempotencyKey } from "@/server/idempotency";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{assertSameOrigin(request);const viewer=await requireApiViewer();const {id}=await params;return privateJSON(await applyToJob(viewer.id,id,await readJSON(request,160000),idempotencyKey(request)),202);}
  catch(error){return errorResponse(error);}
}
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{const viewer=await requireApiViewer();const {id}=await params;return privateJSON(await listApplications(viewer.id,Object.fromEntries(new URL(request.url).searchParams),id));}
  catch(error){return errorResponse(error);}
}
