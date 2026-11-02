import { requireApiViewer } from "@/server/auth";
import { assertSameOrigin,errorResponse,privateJSON,readJSON } from "@/server/http";
import { submitInterview } from "@/server/dal/interviews";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{assertSameOrigin(request);const viewer=await requireApiViewer();const {id}=await params;return privateJSON(await submitInterview(viewer.id,id,await readJSON(request,102400)),202);}
  catch(error){return errorResponse(error);}
}
