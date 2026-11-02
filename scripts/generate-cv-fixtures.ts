import { writeFile } from "node:fs/promises";
import { docxFixture,pdfFixture,syntheticCV } from "../tests/helpers/cv-fixtures";
for(const [name,bytes] of Object.entries({"cv-valid.pdf":pdfFixture(),"cv-valid.docx":docxFixture(),"cv-scan.pdf":pdfFixture(""),"cv-locked.pdf":pdfFixture(syntheticCV,1,true),"cv-invalid.pdf":Buffer.from("%PDF-1.7\nBroken file, synthetic fixture"),"cv-synthetic.txt":Buffer.from(syntheticCV)}))await writeFile(`tests/fixtures/${name}`,bytes);
console.log("Generated synthetic CV fixtures; no personal data.");
