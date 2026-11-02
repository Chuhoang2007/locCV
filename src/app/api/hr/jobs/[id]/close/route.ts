import { requireApiViewer } from "@/server/auth";
import { assertSameOrigin,errorResponse,privateJSON,readJSON } from "@/server/http";
import { parseInput,closeJob } from "@/server/dal/jobs";
import { actionJobSchema } from "@/domain/jobs";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{assertSameOrigin(request);const viewer=await requireApiViewer();const {id}=await context.params;const input=parseInput(actionJobSchema,await readJSON(request));return privateJSON({job:await closeJob(viewer.id,id,input.expected_version)});}
  catch(error){return errorResponse(error);}
}
