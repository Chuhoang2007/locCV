import { requireApiViewer } from "@/server/auth";
import { getMessage } from "@/server/dal/messages";
import { assertSameOrigin,errorResponse,privateJSON } from "@/server/http";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{const viewer=await requireApiViewer();return privateJSON(await getMessage(viewer.id,(await params).id));}catch(error){return errorResponse(error);}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{assertSameOrigin(request);const viewer=await requireApiViewer();return privateJSON(await getMessage(viewer.id,(await params).id,true));}catch(error){return errorResponse(error);}}
