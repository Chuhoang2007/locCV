import { requireApiViewer } from "@/server/auth";
import { assertSameOrigin,errorResponse,privateJSON,readJSON } from "@/server/http";
import { getOwnedJob,saveJob } from "@/server/dal/jobs";
export const dynamic="force-dynamic";
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
  try{const viewer=await requireApiViewer();const {id}=await context.params;return privateJSON(await getOwnedJob(id,viewer.id));}
  catch(error){return errorResponse(error);}
}
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  try{assertSameOrigin(request);const viewer=await requireApiViewer();const {id}=await context.params;return privateJSON({job:await saveJob(viewer.id,id,await readJSON(request,1_048_576))});}
  catch(error){return errorResponse(error);}
}
