import { requireApiViewer } from "@/server/auth";
import { listInbox } from "@/server/dal/messages";
import { errorResponse,privateJSON } from "@/server/http";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{const viewer=await requireApiViewer();return privateJSON(await listInbox(viewer.id,Object.fromEntries(new URL(request.url).searchParams)));}catch(error){return errorResponse(error);}}
