import { requireApiViewer } from "@/server/auth";
import { assertSameOrigin,errorResponse,privateJSON } from "@/server/http";
import { idempotencyKey } from "@/server/idempotency";
import { retryTask } from "@/server/tasks";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{assertSameOrigin(request);const viewer=await requireApiViewer();const {id}=await context.params;return privateJSON(await retryTask(viewer.id,id,idempotencyKey(request)),202);}
  catch(error){return errorResponse(error);}
}
