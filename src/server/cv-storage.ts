import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { dbResult } from "./rpc";
import { parseInput } from "./dal/jobs";
import { extractCV, extractionError, MAX_CV_BYTES, validateCVFile } from "./extraction";

export async function uploadCV(actor:string,bytes:Uint8Array,mime:string){
  const source=validateCVFile(bytes,mime);const id=randomUUID();const client=createAdminClient();
  const path=await dbResult(client.rpc("lc_reserve_cv_upload",{p_actor:actor,p_id:id,p_source:source}));
  const {error}=await client.storage.from("cvs").upload(path,bytes,{contentType:mime,upsert:false});
  if(error){
    await client.from("cv_uploads").update({state:"FAILED"}).eq("id",id).eq("owner_user_id",actor);
    throw new AppError("CV_STORAGE_UNAVAILABLE",503,"Chưa lưu được CV. Hãy thử lại hoặc dán văn bản CV.");
  }
  return {upload_id:id,source};
}
const extractionInput=z.strictObject({upload_id:z.uuid()});
const beginResult=z.object({ready:z.boolean(),text:z.string().optional(),storage_path:z.string().optional(),source:z.enum(["PDF","DOCX"])});
export async function extractUpload(actor:string,value:unknown){
  const {upload_id}=parseInput(extractionInput,value);const token=randomUUID();const client=createAdminClient();
  const input=beginResult.parse(await dbResult(client.rpc("lc_begin_cv_extraction",{p_actor:actor,p_upload:upload_id,p_token:token})));
  if(input.ready)return {upload_id,source:input.source,text:input.text!};
  try{
    const {data,error}=await client.storage.from("cvs").download(input.storage_path!);
    if(error||!data)throw new AppError("CV_STORAGE_UNAVAILABLE",503,"Chưa đọc được file CV. Hãy thử file khác hoặc dán văn bản.");
    if(data.size>MAX_CV_BYTES)throw extractionError("CV_INVALID_FILE");
    const bytes=new Uint8Array(await data.arrayBuffer());
    validateCVFile(bytes,input.source==="PDF"?"application/pdf":"application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    const text=await extractCV(bytes,input.source);
    if(!await dbResult(client.rpc("lc_finish_cv_extraction",{p_actor:actor,p_upload:upload_id,p_token:token,p_text:text})))throw new AppError("CV_UPLOAD_EXPIRED",409,"File CV đã hết hạn. Hãy tải file lại.");
    return {upload_id,source:input.source,text};
  }catch(error){
    await client.rpc("lc_finish_cv_extraction",{p_actor:actor,p_upload:upload_id,p_token:token,p_text:null});
    throw error;
  }
}
export async function cvDownloadLink(actor:string,id:string){
  const record=z.object({id:z.uuid(),path:z.string(),source:z.enum(["PDF","DOCX"])}).parse(await dbResult(createAdminClient().rpc("lc_cv_download",{p_actor:actor,p_application:parseInput(z.uuid(),id)})));
  const {data,error}=await createAdminClient().storage.from("cvs").createSignedUrl(record.path,60,{download:`CV-${record.id}.${record.source.toLowerCase()}`});
  if(error||!data)throw new AppError("CV_STORAGE_UNAVAILABLE",503,"Chưa tạo được liên kết tải. Hãy thử lại.");
  return {url:data.signedUrl,expires_in:60};
}
