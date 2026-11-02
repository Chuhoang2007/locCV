import { requireApiViewer } from "@/server/auth";
import { decideApplication } from "@/server/dal/messages";
import { assertSameOrigin,errorResponse,privateJSON,readJSON } from "@/server/http";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{assertSameOrigin(request);const viewer=await requireApiViewer();const {id}=await params;return privateJSON(await decideApplication(viewer.id,id,await readJSON(request)));}
  catch(error){return errorResponse(error);}
}
