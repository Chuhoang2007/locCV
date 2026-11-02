import { requireApiViewer } from "@/server/auth";
import { errorResponse,privateJSON } from "@/server/http";
import { getInterview } from "@/server/dal/interviews";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{const viewer=await requireApiViewer();const {id}=await params;return privateJSON(await getInterview(viewer.id,id));}
  catch(error){return errorResponse(error);}
}
