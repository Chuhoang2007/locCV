import { test,expect,type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { syntheticCV } from "../helpers/cv-fixtures";
const origin="http://127.0.0.1:3000",provider="http://127.0.0.1:54329";
const fixture=JSON.parse(readFileSync(new URL("../fixtures/generated-job.json",import.meta.url),"utf8"));
const headers=()=>({Origin:origin,"Idempotency-Key":crypto.randomUUID()});
test.beforeEach(async({request})=>{await request.post(`${provider}/__test/reset`);});
async function login(page:Page,email:string){await page.goto("/login");await page.getByLabel("Địa chỉ email").fill(email);await page.getByLabel("Mật khẩu",{exact:true}).fill("e2e-only-passphrase-2026");await page.getByRole("button",{name:"Đăng nhập",exact:true}).click();await expect(page).toHaveURL(/\/settings$/);}
async function publish(page:Page,policy="CV_THRESHOLD"){
  const created=await page.request.post("/api/hr/jobs",{headers:headers(),data:{raw_hr_prompt:"Tin tuyển dụng giả lập cho kiểm thử CV",generate:false}});expect(created.status()).toBe(201);const {job_id}=await created.json();
  const saved=await page.request.patch(`/api/hr/jobs/${job_id}`,{headers:headers(),data:{expected_version:1,draft:{...fixture,jd:{...fixture.jd,title:"Frontend Developer — kiểm thử CV"},interview_access_policy:policy}}});expect(saved.ok()).toBe(true);
  const published=await page.request.post(`/api/hr/jobs/${job_id}/publish`,{headers:headers(),data:{expected_version:2}});expect(published.ok()).toBe(true);return job_id as string;
}
async function capture(page:Page,name:string){
  await mkdir(".impeccable/review",{recursive:true});
  for(const [suffix,width,height] of [["desktop",1440,960],["mobile",390,844]] as const){await page.setViewportSize({width,height});await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.impeccable/review/phase3-${name}-${suffix}.png`,fullPage:true,animations:"disabled"});}
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);
}
async function confirm(page:Page){await page.getByLabel("Tôi đã đọc và xác nhận",{exact:false}).check();await page.getByLabel("Tôi đồng ý để CV",{exact:false}).check();}
test("DOCX → confirm → CV threshold → HR evidence, private file and unauthorized access",async({page,browser})=>{
  test.setTimeout(60000);
  await login(page,"hr-a@example.test");const job=await publish(page);
  for(const mode of ["HR","CANDIDATE"]){await page.request.patch("/api/me",{headers:{Origin:origin},data:{preferred_mode:mode}});expect((await page.request.post(`/api/jobs/${job}/applications`,{headers:headers(),data:{cv_source:"TEXT",upload_id:null,cv_text:syntheticCV,ai_processing_acknowledged:true}})).status()).toBe(403);}
  const candidate=await browser.newContext({baseURL:origin});const cvPage=await candidate.newPage();await login(cvPage,"candidate-b@example.test");await cvPage.goto(`/jobs/${job}/apply`);
  const extractionRequest=cvPage.waitForRequest(request=>request.url().endsWith("/api/cv/extract")).then(request=>request.postDataJSON());
  await cvPage.getByLabel("Chọn file CV",{exact:true}).setInputFiles("tests/fixtures/cv-valid.docx");const uploaded=await extractionRequest;
  await expect(cvPage.getByLabel("Kiểm tra nội dung đã trích xuất")).toHaveValue(syntheticCV);
  await cvPage.getByRole("button",{name:"Gửi hồ sơ ứng tuyển",exact:true}).click();await expect(cvPage).toHaveURL(new RegExp(`/jobs/${job}/apply$`));
  await confirm(cvPage);await capture(cvPage,"apply");
  await cvPage.getByRole("button",{name:"Gửi hồ sơ ứng tuyển",exact:true}).click();await expect(cvPage).toHaveURL(/\/candidate\/applications\/[a-f0-9-]+$/);
  const id=cvPage.url().split("/").at(-1)!;await cvPage.reload();await expect(cvPage.getByRole("heading",{name:"Đủ điều kiện làm bài",exact:true})).toBeVisible({timeout:20000});
  const detail=await cvPage.request.get(`/api/applications/${id}`);expect(detail.headers()["cache-control"]).toBe("private, no-store");const app=await detail.json();expect(app.cv_score).toBe(60);expect(app.report).toBeNull();expect(app.criterion_labels).toBeNull();expect(JSON.stringify(app)).not.toMatch(/correct_answer|scoring_guidance|job_snapshot_json|cv_storage_path/);
  expect(await (await cvPage.request.get(`/api/tasks/${app.task.id}`)).text()).not.toMatch(/cv_text|snapshot|secret|scoring_guidance/);
  await capture(cvPage,"candidate");
  await cvPage.goto(`/jobs/${job}/apply`);await expect(cvPage.getByText("Bạn đã nộp hồ sơ cho vị trí này.",{exact:false})).toBeVisible();
  await cvPage.goto("/candidate/applications");await expect(cvPage.getByRole("heading",{name:"Frontend Developer — kiểm thử CV",exact:true})).toBeVisible();
  await page.request.patch("/api/me",{headers:{Origin:origin},data:{preferred_mode:"HR"}});
  await page.goto(`/hr/jobs/${job}`);await expect(page.getByRole("heading",{name:"Ứng viên B (kiểm thử)",exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Xem hồ sơ",exact:true}).click();await expect(page.getByRole("heading",{name:"Chi tiết từng tiêu chí"})).toBeVisible();await expect(page.getByText("Developed TypeScript",{exact:true})).toBeVisible();await capture(page,"hr");
  const link=await page.request.post(`/api/applications/${id}/cv/download-link`,{headers:{Origin:origin}});expect(link.ok()).toBe(true);const signed=await link.json();expect(signed.expires_in).toBe(60);expect((await page.request.get(signed.url)).ok()).toBe(true);
  expect((await page.request.get(`/api/applications/${id}`)).status()).toBe(404);
  expect((await cvPage.request.get(`/api/hr/applications/${id}`)).status()).toBe(404);
  expect((await page.request.get(`/api/hr/applications/${id}`)).ok()).toBe(true);
  await page.request.post(`${provider}/__test/expire-links`);expect((await page.request.get(signed.url)).status()).toBe(403);
  const outsider=await browser.newContext({baseURL:origin});const outside=await outsider.newPage();await login(outside,"other-c@example.test");
  for(const url of [`/api/applications/${id}`,`/api/hr/applications/${id}`,`/api/tasks/${app.task.id}`,`/api/hr/jobs/${job}/applications`])expect((await outside.request.get(url)).status()).toBe(404);
  expect((await outside.request.post(`/api/applications/${id}/cv/download-link`,{headers:{Origin:origin}})).status()).toBe(404);
  expect((await outside.request.post("/api/cv/extract",{headers:{Origin:origin},data:{upload_id:uploaded.upload_id}})).status()).toBe(404);
  await outsider.close();await candidate.close();
});
test("PDF extraction errors recover to text; AI failure remains ungraded and manual retry survives reload",async({page,browser})=>{
  await login(page,"hr-a@example.test");const job=await publish(page,"ALWAYS");const candidate=await browser.newContext({baseURL:origin});const cvPage=await candidate.newPage();await login(cvPage,"candidate-b@example.test");await cvPage.goto(`/jobs/${job}/apply`);
  await cvPage.getByLabel("Chọn file CV",{exact:true}).setInputFiles("tests/fixtures/cv-scan.pdf");await expect(cvPage.getByRole("alert").filter({hasText:"PDF scan"})).toBeVisible();await capture(cvPage,"file-error");
  await cvPage.getByRole("button",{name:"Dán CV thay thế"}).click();await cvPage.getByLabel("Nội dung CV",{exact:true}).fill(`${syntheticCV} E2E_FAIL_ONCE E2E_LOW_SCORE ${crypto.randomUUID()}`);await confirm(cvPage);
  await cvPage.getByRole("button",{name:"Gửi hồ sơ ứng tuyển",exact:true}).click();await expect(cvPage.getByRole("heading",{name:"Chưa thể hoàn tất đánh giá CV",exact:true})).toBeVisible({timeout:20000});
  const id=cvPage.url().split("/").at(-1)!;let app=await (await cvPage.request.get(`/api/applications/${id}`)).json();expect(app.cv_score).toBeNull();expect(app.status).toBe("CV_SUBMITTED");expect(app.eligibility.eligible).toBe(false);await capture(cvPage,"ai-error");
  await cvPage.reload();await cvPage.getByRole("button",{name:"Thử chấm lại CV"}).click();await expect(cvPage.getByRole("heading",{name:"Đủ điều kiện làm bài",exact:true})).toBeVisible({timeout:20000});
  app=await (await cvPage.request.get(`/api/applications/${id}`)).json();expect(app.cv_score).toBe(59);expect(app.status).toBe("CV_FAILED");expect(app.eligibility.eligible).toBe(true);await candidate.close();
});
test("valid PDF and below-threshold CV stay locked under CV_THRESHOLD",async({page,browser})=>{
  await login(page,"hr-a@example.test");const job=await publish(page);const candidate=await browser.newContext({baseURL:origin});const cvPage=await candidate.newPage();await login(cvPage,"candidate-b@example.test");await cvPage.goto(`/jobs/${job}/apply`);
  await cvPage.getByLabel("Chọn file CV",{exact:true}).setInputFiles("tests/fixtures/cv-valid.pdf");await expect(cvPage.getByLabel("Kiểm tra nội dung đã trích xuất")).toHaveValue(/Developed TypeScript/);
  await cvPage.getByLabel("Dán văn bản",{exact:true}).check();await cvPage.getByLabel("Nội dung CV",{exact:true}).fill(`${syntheticCV} E2E_LOW_SCORE`);await confirm(cvPage);await cvPage.getByRole("button",{name:"Gửi hồ sơ ứng tuyển",exact:true}).click();
  await expect(cvPage.getByRole("heading",{name:"Chưa đủ điều kiện làm bài",exact:true})).toBeVisible({timeout:20000});const app=await (await cvPage.request.get(`/api/applications/${cvPage.url().split('/').at(-1)}`)).json();expect(app.cv_score).toBe(59);expect(app.eligibility.eligible).toBe(false);
  await candidate.close();
});
