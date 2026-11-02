// Isolated text-only parser. No app imports, credentials, HTML rendering or external fetches.
import { fromBuffer } from "yauzl";
import { SaxesParser } from "saxes";
const MAX_FILE=5*1024*1024,MAX_EXPANDED=20*1024*1024,MAX_ENTRIES=200;
function fail(code){throw new Error(code);}
function clean(value){
  const text=value.replace(/\r\n?/g,"\n").replace(/\u0000/g,"").replace(/\u00a0/g," ").trim();
  if(text.length>30000)fail("CV_TEXT_TOO_LONG");
  if(text.length<100)fail("CV_NO_TEXT");
  return text;
}
async function pdf(bytes){
  const {getDocument}=await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,disableFontFace:true,useSystemFonts:false,
    useWorkerFetch:false,disableAutoFetch:true,disableStream:true,stopAtErrors:true,verbosity:0});
  let doc;
  try{
    doc=await task.promise;
    if(doc.numPages>20)fail("CV_TOO_MANY_PAGES");
    let text="";
    for(let i=1;i<=doc.numPages;i++){
      const page=await doc.getPage(i);
      const content=await page.getTextContent();
      for(const item of content.items)if("str" in item){text+=item.str+(item.hasEOL?"\n":" ");if(text.length>31000)fail("CV_TEXT_TOO_LONG");}
      text+="\n";page.cleanup();
    }
    return clean(text);
  }catch(error){if(error?.name==="PasswordException")fail("CV_PASSWORD_PROTECTED");throw error;}
  finally{await task.destroy();}
}
async function docx(bytes){
  return new Promise((resolve,reject)=>fromBuffer(bytes,{lazyEntries:true,validateEntrySizes:true,strictFileNames:true},(error,zip)=>{
    if(error||!zip)return reject(new Error("CV_INVALID_FILE"));
    let count=0,declared=0,actual=0,document,types;const names=new Set();
    const abort=error=>{zip.close();reject(error);};
    zip.on("error",()=>abort(new Error("CV_INVALID_FILE")));
    zip.on("entry",entry=>{
      if(++count>MAX_ENTRIES||(declared+=entry.uncompressedSize)>MAX_EXPANDED||entry.isEncrypted()||names.has(entry.fileName)||
        /vbaProject\.bin$/i.test(entry.fileName)||((entry.externalFileAttributes>>>16)&0o170000)===0o120000)return abort(new Error("CV_ARCHIVE_LIMIT"));
      names.add(entry.fileName);
      if(entry.fileName.endsWith("/")){zip.readEntry();return;}
      zip.openReadStream(entry,(error,stream)=>{
        if(error||!stream)return abort(new Error("CV_INVALID_FILE"));
        const chunks=[];const capture=["word/document.xml","[Content_Types].xml"].includes(entry.fileName);
        stream.on("error",()=>abort(new Error("CV_INVALID_FILE")));
        stream.on("data",chunk=>{
          actual+=chunk.length;
          if(actual>MAX_EXPANDED){stream.destroy();abort(new Error("CV_ARCHIVE_LIMIT"));return;}
          if(capture)chunks.push(chunk);
        });
        stream.on("end",()=>{
          if(entry.fileName==="word/document.xml")document=Buffer.concat(chunks).toString("utf8");
          if(entry.fileName==="[Content_Types].xml")types=Buffer.concat(chunks).toString("utf8");
          zip.readEntry();
        });
      });
    });
    zip.on("end",()=>{
      try{
        if(!document||!types?.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"))fail("CV_INVALID_FILE");
        const parser=new SaxesParser({xmlns:true});let inside=false,text="";
        parser.on("doctype",()=>fail("CV_INVALID_FILE"));
        parser.on("opentag",tag=>{
          if(tag.uri!=="http://schemas.openxmlformats.org/wordprocessingml/2006/main")return;
          if(tag.local==="t")inside=true;
          if(["tab","br"].includes(tag.local))text+=" ";
        });
        parser.on("text",value=>{if(inside){text+=value;if(text.length>31000)fail("CV_TEXT_TOO_LONG");}});
        parser.on("closetag",tag=>{if(tag.uri==="http://schemas.openxmlformats.org/wordprocessingml/2006/main"){if(tag.local==="t")inside=false;if(tag.local==="p")text+="\n";}});
        parser.on("error",()=>fail("CV_INVALID_FILE"));
        parser.write(document).close();resolve(clean(text));
      }catch(error){reject(error);}
    });
    zip.readEntry();
  }));
}
const allowed=new Set(["CV_TEXT_TOO_LONG","CV_NO_TEXT","CV_TOO_MANY_PAGES","CV_PASSWORD_PROTECTED","CV_ARCHIVE_LIMIT","CV_INVALID_FILE"]);
try{
  let length=0;const chunks=[];
  for await(const chunk of process.stdin){length+=chunk.length;if(length>MAX_FILE)fail("CV_INVALID_FILE");chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);
  const source=process.argv[2];
  const text=source==="PDF"?await pdf(bytes):source==="DOCX"?await docx(bytes):fail("CV_INVALID_FILE");
  process.stdout.write(JSON.stringify({text}));
}catch(error){process.stdout.write(JSON.stringify({error:allowed.has(error?.message)?error.message:"CV_INVALID_FILE"}));process.exitCode=1;}
