import { test,expect,type Page,type Browser } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { syntheticCV } from "../helpers/cv-fixtures";
const fixture=JSON.parse(readFileSync(new URL("../fixtures/generated-job.json",import.meta.url),"utf8"));
const origin="http://127.0.0.1:3000",provider="http://127.0.0.1:54329";
const essay="Tôi kiểm tra schema trước xử lý. Tôi bắt lỗi và che dữ liệu riêng.";
const headers=()=>({Origin:origin,"Idempotency-Key":crypto.randomUUID()});
test.beforeEach(async({request})=>{await request.post(`${provider}/__test/reset`);});
async function login(page:Page,email:string){await page.goto("/login");await page.getByLabel("Địa chỉ email").fill(email);await page.getByLabel("Mật khẩu",{exact:true}).fill("e2e-only-passphrase-2026");await page.getByRole("button",{name:"Đăng nhập",exact:true}).click();await expect(page).toHaveURL(/\/settings$/);}
async function setup(hr:Page,browser:Browser){
  await login(hr,"hr-a@example.test");const created=await hr.request.post("/api/hr/jobs",{headers:headers(),data:{raw_hr_prompt:"Dữ liệu giả lập cho bài thi",generate:false}});expect(created.status()).toBe(201);const {job_id}=await created.json();
  const draft={...fixture,interview_questions:{...fixture.interview_questions,duration_minutes:5},interview_access_policy:"CV_THRESHOLD"};
  expect((await hr.request.patch(`/api/hr/jobs/${job_id}`,{headers:headers(),data:{expected_version:1,draft}})).ok()).toBe(true);
  expect((await hr.request.post(`/api/hr/jobs/${job_id}/publish`,{headers:headers(),data:{expected_version:2}})).ok()).toBe(true);
  const context=await browser.newContext({baseURL:origin}),page=await context.newPage();page.on("dialog",dialog=>dialog.accept());await login(page,"candidate-b@example.test");
  const applied=await page.request.post(`/api/jobs/${job_id}/applications`,{headers:headers(),data:{cv_source:"TEXT",upload_id:null,cv_text:syntheticCV+" "+crypto.randomUUID(),ai_processing_acknowledged:true}});expect(applied.status()).toBe(202);const {application_id:id}=await applied.json();
  await expect.poll(async()=>{const response=await page.request.get(`/api/applications/${id}`);return (await response.json()).cv_score;},{timeout:20000}).toBe(60);
  await page.goto(`/candidate/applications/${id}/interview`);return {context,page,id:id as string,job:job_id as string};
}
async function capture(page:Page,name:string){
  await mkdir(".impeccable/review",{recursive:true});for(const [suffix,width,height] of [["desktop",1440,960],["mobile",390,844]] as const){await page.setViewportSize({width,height});await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.impeccable/review/phase4-${name}-${suffix}.png`,fullPage:true,animations:"disabled"});}
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);
}
async function allAnswers(page:Page,text=essay){
  await page.getByRole("button",{name:"Câu 1, trắc nghiệm",exact:true}).click();await page.getByLabel("Khi kiểm tra hoặc biên dịch mã",{exact:true}).check();
  await page.getByRole("button",{name:"Câu 2, trắc nghiệm",exact:true}).click();await page.getByLabel("Thay đổi mới không làm hỏng hành vi cần giữ",{exact:true}).check();
  await page.getByRole("button",{name:"Câu 3, tự luận",exact:true}).click();await page.getByLabel("Câu trả lời tự luận",{exact:true}).fill(text);
}
async function saveNow(page:Page){await page.getByRole("button",{name:"Lưu ngay",exact:true}).click();await expect(page.getByText("Đã lưu trên server",{exact:true})).toBeVisible();}
async function submit(page:Page){await page.getByRole("button",{name:"Nộp bài",exact:true}).click();await page.getByRole("button",{name:"Xác nhận nộp bài",exact:true}).click();await expect(page.getByRole("heading",{name:"Bài làm đã được khóa",exact:true})).toBeVisible();}
test("start → autosave/reload → multi-tab conflict → explicit local recovery → 88-point report",async({page:hr,browser})=>{
  test.setTimeout(120000);const {context,page,id}=await setup(hr,browser);
  let dto=await (await page.request.get(`/api/applications/${id}/interview`)).json();expect(dto.state).toBe("NOT_STARTED");expect(dto.questions).toBeNull();expect(await page.content()).not.toMatch(/correct_answer|scoring_guidance|q_typescript/);await capture(page,"prestart");
  await page.getByRole("button",{name:"Bắt đầu bài thi",exact:true}).click();await expect(page.getByRole("heading",{name:"Bài thi tuyển dụng",exact:true})).toBeVisible();
  dto=await (await page.request.get(`/api/applications/${id}/interview`)).json();const deadline=dto.deadline_at;expect(JSON.stringify(dto)).not.toMatch(/correct_answer|scoring_guidance|rubric/);
  await page.clock.setSystemTime(new Date("2040-01-01T00:00:00Z"));await expect(page.getByRole("timer")).not.toHaveText("00:00");expect((await (await page.request.get(`/api/applications/${id}/interview`)).json()).deadline_at).toBe(deadline);await page.clock.setSystemTime(new Date());
  await allAnswers(page);await saveNow(page);await capture(page,"runner");await page.reload();await page.getByRole("button",{name:/Câu 3, tự luận/}).click();await expect(page.getByLabel("Câu trả lời tự luận",{exact:true})).toHaveValue(essay);
  expect((await (await page.request.get(`/api/applications/${id}/interview`)).json()).deadline_at).toBe(deadline);
  const other=await context.newPage();await other.goto(`/candidate/applications/${id}/interview`);await other.route(`**/api/applications/${id}/interview`,route=>route.abort());
  await page.getByRole("button",{name:/Câu 1, trắc nghiệm/}).click();await page.getByLabel("Tự kiểm tra mọi response lúc runtime",{exact:true}).check();await saveNow(page);
  await other.getByLabel("Tự kiểm tra mọi response lúc runtime",{exact:true}).check();await other.getByRole("button",{name:"Lưu ngay",exact:true}).click();await expect(other.getByText("Có xung đột phiên bản",{exact:true})).toBeVisible();await capture(other,"conflict");
  await other.unroute(`**/api/applications/${id}/interview`);await other.getByRole("button",{name:"Dùng bản trên server",exact:true}).click();await expect(other.getByText("Đã lưu trên server",{exact:true})).toBeVisible();await other.close();
  await page.getByLabel("Khi kiểm tra hoặc biên dịch mã",{exact:true}).check();await saveNow(page);
  await page.getByLabel("Lưu tạm câu trả lời trên thiết bị này",{exact:false}).check();await page.route(`**/api/applications/${id}/answers`,route=>route.abort("internetdisconnected"));
  await page.getByRole("button",{name:/Câu 3, tự luận/}).click();await page.getByLabel("Câu trả lời tự luận",{exact:true}).fill(essay+" Bản khôi phục.");await page.getByRole("button",{name:"Lưu ngay",exact:true}).click();await expect(page.getByText("Chưa đồng bộ",{exact:true})).toBeVisible();
  const buffers=await page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.startsWith("loccv-answers:")));expect(buffers.length).toBeGreaterThan(0);expect(buffers.map(([,value])=>value).join("")).not.toMatch(/correct_answer|scoring_guidance|cv_text|access_token/);
  await page.reload();await expect(page.getByRole("heading",{name:"Có bản lưu tạm chưa đồng bộ",exact:true})).toBeVisible();await capture(page,"recovery");
  await page.unroute(`**/api/applications/${id}/answers`);await page.getByRole("button",{name:"Khôi phục bản tạm",exact:true}).click();await saveNow(page);
  await page.getByRole("button",{name:/Câu 3, tự luận/}).click();await expect(page.getByLabel("Câu trả lời tự luận",{exact:true})).toHaveValue(essay+" Bản khôi phục.");
  await page.getByLabel("Câu trả lời tự luận",{exact:true}).fill(essay+" Bản cuối cùng.");await page.getByRole("button",{name:"Nộp bài",exact:true}).click();await capture(page,"confirm");await page.getByRole("button",{name:"Xác nhận nộp bài",exact:true}).click();await expect(page.getByRole("heading",{name:"Bài làm đã được khóa",exact:true})).toBeVisible();await capture(page,"submitted");await page.getByRole("link",{name:"Theo dõi kết quả",exact:true}).click();await expect(page).toHaveURL(new RegExp(`/candidate/applications/${id}$`));
  await expect.poll(async()=>{return (await (await page.request.get(`/api/applications/${id}`)).json()).interview_score;},{timeout:20000}).toBe(88);await page.reload();await expect(page.getByRole("heading",{name:"Kết quả bài thi",exact:true})).toBeVisible();const app=await (await page.request.get(`/api/applications/${id}`)).json();expect(app.quiz_score).toBe(100);expect(app.essay_score).toBe(80);expect(app.cv_score).toBe(60);expect(app.interview_review).toBeNull();expect(JSON.stringify(app)).not.toMatch(/correct_answer|scoring_guidance|rubric/);expect(await page.content()).not.toMatch(/correct_answer|scoring_guidance|TypeScript kiểm tra kiểu chủ yếu khi nào/);await capture(page,"candidate-result");
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith("loccv-answers:")).length)).toBe(0);
  expect((await hr.request.get(`/api/applications/${id}/interview`)).status()).toBe(404);expect((await hr.request.put(`/api/applications/${id}/answers`,{headers:{Origin:origin},data:{answer_version:0,answers:{quiz:[],essay:[]}}})).status()).toBe(404);
  await hr.request.patch("/api/me",{headers:{Origin:origin},data:{preferred_mode:"HR"}});await hr.goto(`/hr/applications/${id}`);await expect(hr.getByRole("heading",{name:"Trắc nghiệm — đáp án và điểm",exact:true})).toBeVisible();await capture(hr,"hr-result");
  await context.close();
});
test("timeout sweep receives persisted answers while browser is offline; late edits cannot be counted",async({page:hr,browser})=>{
  test.setTimeout(60000);const {context,page,id}=await setup(hr,browser);await page.getByRole("button",{name:"Bắt đầu bài thi",exact:true}).click();await page.getByLabel("Khi kiểm tra hoặc biên dịch mã",{exact:true}).check();await saveNow(page);
  await context.setOffline(true);expect((await hr.request.post(`${provider}/__test/expire-interview`,{data:{application_id:id}})).ok()).toBe(true);
  await expect.poll(async()=>!!(await (await hr.request.get(`/api/hr/applications/${id}`)).json()).interview_submitted_at,{timeout:25000}).toBe(true);await context.setOffline(false);await page.reload();await expect(page.getByRole("heading",{name:"Bài làm đã được khóa",exact:true})).toBeVisible();
  const app=await (await page.request.get(`/api/applications/${id}`)).json();expect(app.submission_reason).toBe("TIMEOUT");expect(app.quiz_score).toBe(50);
  await expect.poll(async()=>(await (await page.request.get(`/api/applications/${id}`)).json()).interview_score,{timeout:20000}).toBe(20);
  expect((await page.request.put(`/api/applications/${id}/answers`,{headers:{Origin:origin},data:{answer_version:1,answers:{quiz:[],essay:[{question_id:"e_api",text:essay}]}}})).status()).toBe(409);
  expect((await page.request.post(`/api/applications/${id}/interview/submit`,{headers:{Origin:origin},data:{answer_version:1,answers:{quiz:[],essay:[]},score:100}})).status()).toBe(400);
  await context.close();
});
test("essay failure keeps quiz 100 and total null; retry resumes grading without a second submission",async({page:hr,browser})=>{
  test.setTimeout(60000);const {context,page,id}=await setup(hr,browser);await page.getByRole("button",{name:"Bắt đầu bài thi",exact:true}).click();await allAnswers(page,essay+" E2E_ESSAY_FAIL_ONCE "+crypto.randomUUID());await submit(page);await page.getByRole("link",{name:"Theo dõi kết quả",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Chưa hoàn tất chấm tự luận",exact:true})).toBeVisible({timeout:20000});const failed=await (await page.request.get(`/api/applications/${id}`)).json();expect(failed.quiz_score).toBe(100);expect(failed.essay_score).toBeNull();expect(failed.interview_score).toBeNull();await capture(page,"essay-error");
  await page.getByRole("button",{name:"Thử chấm lại tự luận",exact:true}).click();await expect.poll(async()=>(await (await page.request.get(`/api/applications/${id}`)).json()).interview_score,{timeout:20000}).toBe(88);
  expect((await page.request.post(`/api/applications/${id}/interview/submit`,{headers:{Origin:origin},data:{answer_version:0}})).status()).toBe(202);await context.close();
});
test("signing out clears unsynchronized buffers and stops another open exam tab from recreating them",async({page:hr,browser})=>{
  test.setTimeout(60000);const {context,page,id}=await setup(hr,browser);await page.getByRole("button",{name:"Bắt đầu bài thi",exact:true}).click();
  const other=await context.newPage();await other.goto(`/candidate/applications/${id}/interview`);
  await page.getByLabel("Lưu tạm câu trả lời trên thiết bị này",{exact:false}).check();await page.route(`**/api/applications/${id}/answers`,route=>route.abort("internetdisconnected"));
  await page.getByRole("button",{name:/Câu 3, tự luận/}).click();await page.getByLabel("Câu trả lời tự luận",{exact:true}).fill(essay);await page.getByRole("button",{name:"Lưu ngay",exact:true}).click();await expect(page.getByText("Chưa đồng bộ",{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith("loccv-answers:")))).toBe(true);
  await page.getByRole("button",{name:"Đăng xuất",exact:true}).click();await expect(page).toHaveURL(/\/login$/);await expect(other.getByRole("alert").filter({hasText:"Bạn đã đăng xuất"})).toBeVisible();
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith("loccv-answers:")).length)).toBe(0);await context.close();
});
