import { deflateRawSync } from "node:zlib";
export const syntheticCV="SYNTHETIC CV - not a real person. Developed TypeScript and React applications. Wrote unit tests, integration tests and accessible user interfaces. Worked with SQL transactions and reviewed code with a product team. Documented deployment and operational procedures.";
function crc32(bytes:Buffer){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export function zipFixture(files:Record<string,string|Buffer>){
  const local:Buffer[]=[],central:Buffer[]=[];let offset=0;
  for(const [name,value] of Object.entries(files)){
    const filename=Buffer.from(name),raw=Buffer.isBuffer(value)?value:Buffer.from(value),data=deflateRawSync(raw);const checksum=crc32(raw);
    const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(8,8);header.writeUInt32LE(checksum,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(raw.length,22);header.writeUInt16LE(filename.length,26);
    local.push(header,filename,data);
    const dir=Buffer.alloc(46);dir.writeUInt32LE(0x02014b50);dir.writeUInt16LE(20,4);dir.writeUInt16LE(20,6);dir.writeUInt16LE(8,10);dir.writeUInt32LE(checksum,16);dir.writeUInt32LE(data.length,20);dir.writeUInt32LE(raw.length,24);dir.writeUInt16LE(filename.length,28);dir.writeUInt32LE(offset,42);
    central.push(dir,filename);offset+=header.length+filename.length+data.length;
  }
  const centralData=Buffer.concat(central),end=Buffer.alloc(22),count=Object.keys(files).length;
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(count,8);end.writeUInt16LE(count,10);end.writeUInt32LE(centralData.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,centralData,end]);
}
export function docxFixture(text=syntheticCV,extra:Record<string,string|Buffer>={}){
  const escaped=text.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  return zipFixture({"[Content_Types].xml":'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "word/document.xml":`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escaped}</w:t></w:r></w:p></w:body></w:document>`,...extra});
}
export function pdfFixture(text=syntheticCV,pages=1,locked=false){
  const objects:string[]=["",`<< /Type /Catalog /Pages 2 0 R >>`,"",`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`];const kids:string[]=[];
  for(let i=0;i<pages;i++){
    const page=objects.length,streamId=page+1;kids.push(`${page} 0 R`);
    const content=text?`BT /F1 10 Tf 40 700 Td (${text.replace(/[()\\]/g,"\\$&")}) Tj ET`:"";
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`,`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }
  objects[2]=`<< /Type /Pages /Count ${pages} /Kids [${kids.join(" ")}] >>`;
  const encryption=locked?objects.length:0;if(locked)objects.push(`<< /Filter /Standard /V 1 /R 2 /O <${"0".repeat(64)}> /U <${"0".repeat(64)}> /P -4 >>`);
  let output="%PDF-1.4\n";const offsets=[0];
  for(let i=1;i<objects.length;i++){offsets.push(Buffer.byteLength(output));output+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(output);output+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,"0")} 00000 n \n`).join("");
  output+=`trailer\n<< /Size ${objects.length} /Root 1 0 R ${locked?`/Encrypt ${encryption} 0 R /ID [<${"1".repeat(32)}><${"1".repeat(32)}>]`:""} >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output);
}
