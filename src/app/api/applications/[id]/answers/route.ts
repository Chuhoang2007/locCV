import { requireApiViewer } from "@/server/auth";
import { assertSameOrigin,errorResponse,privateJSON,readJSON } from "@/server/http";
import { saveInterviewAnswers } from "@/server/dal/interviews";
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
  try{assertSameOrigin(request);const viewer=await requireApiViewer();const {id}=await params;return privateJSON(await saveInterviewAnswers(viewer.id,id,await readJSON(request,102400)));}
  catch(error){return errorResponse(error);}
}
