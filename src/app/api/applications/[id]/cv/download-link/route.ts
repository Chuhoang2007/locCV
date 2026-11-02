import { requireApiViewer } from "@/server/auth";
import { assertSameOrigin,errorResponse,privateJSON } from "@/server/http";
import { cvDownloadLink } from "@/server/cv-storage";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{assertSameOrigin(request);const viewer=await requireApiViewer();const {id}=await params;return privateJSON(await cvDownloadLink(viewer.id,id));}
  catch(error){return errorResponse(error);}
}
