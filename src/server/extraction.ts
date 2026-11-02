import "server-only";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { z } from "zod";
import { AppError } from "@/lib/errors";
export const MAX_CV_BYTES=5*1024*1024;
const messages:Record<string,string>={
  CV_INVALID_FILE:"File bị hỏng hoặc không đúng PDF/DOCX. Hãy đổi file hoặc dán văn bản CV.",
  CV_NO_TEXT:"Không đọc được đủ văn bản trong CV. PDF scan chưa được hỗ trợ; hãy dùng file có chữ hoặc dán ít nhất 100 ký tự.",
  CV_PASSWORD_PROTECTED:"PDF có mật khẩu. Hãy bỏ mật khẩu hoặc dán văn bản CV.",
  CV_TOO_MANY_PAGES:"PDF chỉ được tối đa 20 trang. Hãy rút gọn hoặc dán văn bản CV.",
  CV_ARCHIVE_LIMIT:"DOCX vượt giới hạn xử lý (20 MiB sau giải nén, 200 mục) hoặc có nội dung không được hỗ trợ. Hãy đổi file hoặc dán CV.",
  CV_TEXT_TOO_LONG:"CV vượt quá 30.000 ký tự. Hãy rút gọn hoặc dán phần nội dung cần gửi.",
  CV_PARSE_TIMEOUT:"Xử lý file quá 10 giây. Hãy đổi file hoặc dán văn bản CV.",
};
export function extractionError(code:string){return new AppError(code in messages?code:"CV_INVALID_FILE",422,messages[code]??messages.CV_INVALID_FILE);}
export function validateCVFile(bytes:Uint8Array,mime:string){
  if(bytes.length>MAX_CV_BYTES)throw new AppError("CV_FILE_TOO_LARGE",413,"CV chỉ được tối đa 5 MiB.");
  const pdf=mime==="application/pdf"&&Buffer.from(bytes.subarray(0,5)).toString("ascii")==="%PDF-";
  const docx=mime==="application/vnd.openxmlformats-officedocument.wordprocessingml.document"&&bytes[0]===0x50&&bytes[1]===0x4b&&bytes[2]===3&&bytes[3]===4;
  if(!pdf&&!docx)throw extractionError("CV_INVALID_FILE");
  return pdf?"PDF" as const:"DOCX" as const;
}
export function extractCV(bytes:Uint8Array,source:"PDF"|"DOCX",timeoutMs=10000):Promise<string>{
  return new Promise((resolveText,reject)=>{
    // Never inherit database/API credentials into the parser process.
    const child=spawn(process.execPath,["--max-old-space-size=128",resolve(process.cwd(),"worker/parser-process.mjs"),source],{
      shell:false,windowsHide:true,env:{NODE_ENV:"production",...(process.env.SystemRoot?{SystemRoot:process.env.SystemRoot}:{})},stdio:["pipe","pipe","ignore"],
    });
    let output="",finished=false;
    function finish(error:Error|null,text?:string){if(finished)return;finished=true;clearTimeout(timer);if(error){child.kill();reject(error);}else resolveText(text!);}
    const timer=setTimeout(()=>finish(extractionError("CV_PARSE_TIMEOUT")),timeoutMs);
    child.once("error",()=>finish(extractionError("CV_INVALID_FILE")));
    child.stdin.on("error",()=>{/* close handler reports parser failure without raw errors */});
    child.stdout.on("data",chunk=>{output+=chunk.toString();if(Buffer.byteLength(output)>200000)finish(extractionError("CV_TEXT_TOO_LONG"));});
    child.once("close",()=>{
      if(finished)return;
      try{
        const result=JSON.parse(output);
        if(result.error)return finish(extractionError(String(result.error)));
        const text=z.string().trim().min(100).max(30000).parse(result.text);
        finish(null,text);
      }catch{finish(extractionError("CV_INVALID_FILE"));}
    });
    child.stdin.end(bytes);
  });
}
