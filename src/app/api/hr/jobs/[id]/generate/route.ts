import { requireApiViewer } from "@/server/auth";
import { assertSameOrigin,errorResponse,privateJSON,readJSON } from "@/server/http";
import { generateJob } from "@/server/dal/jobs";
import { idempotencyKey } from "@/server/idempotency";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{assertSameOrigin(request);const viewer=await requireApiViewer();const {id}=await context.params;return privateJSON(await generateJob(viewer.id,id,await readJSON(request,65536),idempotencyKey(request)),202);}
  catch(error){return errorResponse(error);}
}
