import { describe,it,expect } from "vitest";
import { extractCV,validateCVFile } from "@/server/extraction";
import { docxFixture,pdfFixture,zipFixture,syntheticCV } from "../helpers/cv-fixtures";
const pdfMime="application/pdf",docxMime="application/vnd.openxmlformats-officedocument.wordprocessingml.document";
describe("CV text extraction in a credential-free child process",()=>{
  it("checks MIME, signature and 5 MiB limit before starting a parser",()=>{
    expect(validateCVFile(pdfFixture(),pdfMime)).toBe("PDF");expect(validateCVFile(docxFixture(),docxMime)).toBe("DOCX");
    expect(()=>validateCVFile(docxFixture(),pdfMime)).toThrow();expect(()=>validateCVFile(Buffer.from("not pdf"),pdfMime)).toThrow();
    expect(()=>validateCVFile(Buffer.alloc(5*1024*1024+1),pdfMime)).toThrow(/5 MiB/);
  });
  it("extracts real PDF and DOCX as plain text",async()=>{
    expect(await extractCV(pdfFixture(),"PDF")).toContain("Developed TypeScript");
    expect(await extractCV(docxFixture(),"DOCX")).toBe(syntheticCV);
  });
  it("rejects scan, damaged PDF, encrypted PDF and too many pages without AI",async()=>{
    await expect(extractCV(pdfFixture(""),"PDF")).rejects.toMatchObject({code:"CV_NO_TEXT"});
    await expect(extractCV(Buffer.from("%PDF-1.7 broken"),"PDF")).rejects.toMatchObject({code:"CV_INVALID_FILE"});
    await expect(extractCV(pdfFixture(syntheticCV,1,true),"PDF")).rejects.toMatchObject({code:"CV_PASSWORD_PROTECTED"});
    await expect(extractCV(pdfFixture(syntheticCV,21),"PDF")).rejects.toMatchObject({code:"CV_TOO_MANY_PAGES"});
  });
  it("rejects a fake ZIP, ZIP bomb and too many entries",async()=>{
    await expect(extractCV(zipFixture({"note.txt":"not a DOCX"}),"DOCX")).rejects.toMatchObject({code:"CV_INVALID_FILE"});
    await expect(extractCV(docxFixture(syntheticCV,{"payload.bin":Buffer.alloc(21*1024*1024)}),"DOCX")).rejects.toMatchObject({code:"CV_ARCHIVE_LIMIT"});
    await expect(extractCV(docxFixture(syntheticCV,Object.fromEntries(Array.from({length:201},(_,i)=>[`extra/${i}`,"x"]))),"DOCX")).rejects.toMatchObject({code:"CV_ARCHIVE_LIMIT"});
  });
  it("rejects XML entities, empty/oversized text and kills a timed-out process",async()=>{
    await expect(extractCV(docxFixture("a".repeat(30001)),"DOCX")).rejects.toMatchObject({code:"CV_TEXT_TOO_LONG"});
    await expect(extractCV(docxFixture("tiny"),"DOCX")).rejects.toMatchObject({code:"CV_NO_TEXT"});
    await expect(extractCV(docxFixture(syntheticCV,{"word/document.xml":'<!DOCTYPE doc [<!ENTITY external SYSTEM "https://example.test/secret">]><doc>&external;</doc>'}),"DOCX")).rejects.toMatchObject({code:"CV_INVALID_FILE"});
    await expect(extractCV(pdfFixture(),"PDF",1)).rejects.toMatchObject({code:"CV_PARSE_TIMEOUT"});
  });
});
