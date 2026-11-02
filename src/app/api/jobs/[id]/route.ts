import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { errorResponse } from "@/server/http";
import { getPublicJob } from "@/server/dal/jobs";
export const dynamic="force-dynamic";
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
  try{const {id}=await context.params;const job=await getPublicJob(id);if(!job)throw new AppError("NOT_FOUND",404,"Tin này đã đóng hoặc không còn tồn tại.");return NextResponse.json(job,{headers:{"Cache-Control":"no-store"}});}
  catch(error){return errorResponse(error);}
}
