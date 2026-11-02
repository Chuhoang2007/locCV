import { requireApiViewer } from "@/server/auth";
import { errorResponse,privateJSON } from "@/server/http";
import { listApplications } from "@/server/dal/applications";
export async function GET(request:Request){
  try{const viewer=await requireApiViewer();return privateJSON(await listApplications(viewer.id,Object.fromEntries(new URL(request.url).searchParams)));}
  catch(error){return errorResponse(error);}
}
