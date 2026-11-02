import { requireApiViewer } from "@/server/auth";
import { assertSameOrigin,errorResponse,privateJSON,readJSON } from "@/server/http";
import { extractUpload } from "@/server/cv-storage";
export const runtime="nodejs";
export async function POST(request:Request){
  try{assertSameOrigin(request);const viewer=await requireApiViewer();return privateJSON(await extractUpload(viewer.id,await readJSON(request)));}
  catch(error){return errorResponse(error);}
}
