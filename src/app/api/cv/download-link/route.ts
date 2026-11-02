import { z } from "zod";
import { requireApiViewer } from "@/server/auth";
import { assertSameOrigin,errorResponse,privateJSON,readJSON } from "@/server/http";
import { cvDownloadLink } from "@/server/cv-storage";
import { parseInput } from "@/server/dal/jobs";
export async function POST(request:Request){
  try{assertSameOrigin(request);const viewer=await requireApiViewer();const input=parseInput(z.strictObject({application_id:z.uuid()}),await readJSON(request));return privateJSON(await cvDownloadLink(viewer.id,input.application_id));}
  catch(error){return errorResponse(error);}
}
