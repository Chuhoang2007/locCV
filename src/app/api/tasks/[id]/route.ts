import { requireApiViewer } from "@/server/auth";
import { errorResponse,privateJSON } from "@/server/http";
import { getTask } from "@/server/tasks";
export const dynamic="force-dynamic";
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
  try{const viewer=await requireApiViewer();const {id}=await context.params;return privateJSON(await getTask(viewer.id,id));}
  catch(error){return errorResponse(error);}
}
