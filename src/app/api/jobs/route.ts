import { NextResponse } from "next/server";
import { errorResponse } from "@/server/http";
import { listPublicJobs } from "@/server/dal/jobs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  try{return NextResponse.json(await listPublicJobs(Object.fromEntries(new URL(request.url).searchParams)),{headers:{"Cache-Control":"no-store"}});}
  catch(error){return errorResponse(error);}
}
