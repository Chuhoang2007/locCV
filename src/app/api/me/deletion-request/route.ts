import { requireApiViewer } from "@/server/auth";
import { deletionStatus,requestDeletion } from "@/server/dal/messages";
import { assertSameOrigin,errorResponse,privateJSON,readJSON } from "@/server/http";
export const dynamic="force-dynamic";
export async function GET(){try{return privateJSON(await deletionStatus((await requireApiViewer()).id));}catch(error){return errorResponse(error);}}
export async function POST(request:Request){try{assertSameOrigin(request);const viewer=await requireApiViewer();return privateJSON(await requestDeletion(viewer.id,await readJSON(request)));}catch(error){return errorResponse(error);}}
