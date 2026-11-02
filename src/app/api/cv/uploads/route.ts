import { requireApiViewer } from "@/server/auth";
import { assertSameOrigin,errorResponse,privateJSON,readBytes } from "@/server/http";
import { uploadCV } from "@/server/cv-storage";
import { MAX_CV_BYTES } from "@/server/extraction";
export const runtime="nodejs";
export async function POST(request:Request){
  try{assertSameOrigin(request);const viewer=await requireApiViewer();return privateJSON(await uploadCV(viewer.id,await readBytes(request,MAX_CV_BYTES),request.headers.get("content-type")??""),201);}
  catch(error){return errorResponse(error);}
}
