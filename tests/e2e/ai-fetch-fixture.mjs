// Preload chỉ cho test worker; production không import file này và không có mock mode.
import { readFileSync } from "node:fs";
const fixture=JSON.parse(readFileSync(new URL("../fixtures/generated-job.json",import.meta.url),"utf8"));
const original=globalThis.fetch;
const counts=new Map();
globalThis.fetch=async(input,init)=>{
  const url=String(input);
  if(url.startsWith("http://127.0.0.1:54329/"))return original(input,init);
  if(url!=="https://nine-router-fixture.test/v1/chat/completions")throw new TypeError("Unexpected external network in E2E worker");
  const request=JSON.parse(init.body);const prompt=request.messages[1].content;const n=(counts.get(prompt)??0)+1;counts.set(prompt,n);
  await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,250);init.signal?.addEventListener("abort",()=>{clearTimeout(timer);reject(new DOMException("abort","AbortError"));},{once:true});});
  if(prompt.includes("E2E_TRANSIENT")&&n<=2)return new Response("",{status:n===1?502:504});
  let output=fixture;
  const payload=JSON.parse(prompt);
  if(typeof payload.cv_text==="string"){
    const rubric=payload.scoring_rubric;const low=payload.cv_text.includes("E2E_LOW_SCORE");
    output={criteria:rubric.criteria.map((c,i)=>({criterion_id:c.id,score:i===0?(low?59:60):0,evidence:i===0?["Developed TypeScript"]:[],missing_evidence:[],feedback:"Đánh giá từ dữ liệu CV giả lập, cần HR xem xét."})),summary:"CV kiểm thử có kinh nghiệm TypeScript và kiểm thử. Đây là dữ liệu giả lập."};
  }
  if(Array.isArray(payload.candidate_answers)&&Array.isArray(payload.question_rubrics)){
    output={questions:payload.question_rubrics.map(q=>{const text=payload.candidate_answers.find(a=>a.question_id===q.id)?.text??"";return {question_id:q.id,
      criteria:q.rubric.map((c,i)=>({criterion_id:c.id,score:text.trim()?(i===0?c.max_points:Math.floor(c.max_points/2)):0,evidence:text.trim()?[text.includes("kiểm tra schema")?"kiểm tra schema":text.slice(0,30)]:[],feedback:text.trim()?"Đánh giá từ câu trả lời giả lập.":"Ứng viên bỏ trống."})),feedback:"Nhận xét câu trả lời kiểm thử."};}),summary:"Tổng kết tự luận từ dữ liệu giả lập; cần HR xem xét."};
  }
  const content=((prompt.includes("E2E_FAIL_ONCE")||prompt.includes("E2E_ESSAY_FAIL_ONCE"))&&n===1)||prompt.includes("E2E_ALWAYS_FAIL")?"{invalid JSON":JSON.stringify(output);
  return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content}}]}),{status:200});
};
