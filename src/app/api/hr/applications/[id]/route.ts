import { requireApiViewer } from "@/server/auth";
import { errorResponse,privateJSON } from "@/server/http";
import { getApplication } from "@/server/dal/applications";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{const viewer=await requireApiViewer();const {id}=await params;return privateJSON(await getApplication(viewer.id,id,"HR"));}
  catch(error){return errorResponse(error);}
}
