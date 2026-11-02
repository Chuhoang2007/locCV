import { test,expect,type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const origin="http://127.0.0.1:3000";
test.beforeEach(async({request})=>{await request.post("http://127.0.0.1:54329/__test/reset");});
async function loginHR(page:Page){await page.goto("/login");await page.getByLabel("Địa chỉ email").fill("hr-a@example.test");await page.getByLabel("Mật khẩu",{exact:true}).fill("e2e-only-passphrase-2026");await page.getByRole("button",{name:"Đăng nhập",exact:true}).click();await expect(page).toHaveURL(/\/settings$/);await page.getByRole("button",{name:"Tuyển dụng",exact:true}).click();await expect(page.getByRole("button",{name:"Tuyển dụng",exact:true})).toHaveAttribute("aria-pressed","true");}

test("HR tạo AI qua retry, chỉnh ba phần, đăng, khách tìm việc rồi đóng tin",async({page,browser})=>{
  await loginHR(page);await page.goto("/hr/jobs/new");
  await page.getByLabel("Bạn đang tìm người như thế nào?").fill(`E2E_TRANSIENT ${crypto.randomUUID()} Tuyển frontend React TypeScript, lương 20–30 triệu tại Hà Nội.`);
  await page.getByRole("button",{name:"Tạo bản nháp bằng AI"}).click();await expect(page).toHaveURL(/\/hr\/jobs\/[a-f0-9-]+\/edit$/);
  await expect(page.getByText("Bản nháp AI đã sẵn sàng",{exact:true})).toBeVisible({timeout:20000});
  await expect(page.getByLabel("Tên vị trí tuyển dụng")).toHaveValue("Frontend Developer — React & TypeScript");
  await page.getByLabel("Tên vị trí tuyển dụng").fill("Frontend Developer — Đội sản phẩm (kiểm thử)");
  await page.getByRole("tab",{name:/Tiêu chí CV/}).click();
  await page.getByLabel("Điểm tối đa",{exact:true}).first().fill("59");await expect(page.getByText("99/100 điểm",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Duyệt & đăng tuyển"})).toBeDisabled();
  await page.getByLabel("Điểm tối đa",{exact:true}).first().fill("60");
  await page.getByRole("button",{name:"Thêm tiêu chí",exact:true}).click();await page.getByRole("button",{name:"Xóa tiêu chí 3",exact:true}).click();
  // Lỗi nằm ở tab khác: save phải mở đúng tab, gắn lỗi và focus đúng control.
  await page.getByLabel("Điểm tối đa",{exact:true}).first().fill("101");
  await page.getByRole("tab",{name:"Mô tả công việc",exact:true}).click();await page.getByRole("button",{name:"Lưu nháp",exact:true}).click();
  await expect(page.getByRole("tab",{name:/Tiêu chí CV/})).toHaveAttribute("aria-selected","true");
  await expect(page.getByLabel("Điểm tối đa",{exact:true}).first()).toBeFocused();await expect(page.getByLabel("Điểm tối đa",{exact:true}).first()).toHaveAttribute("aria-invalid","true");
  await expect(page.getByText("Giá trị tối đa là 100.",{exact:true})).toBeVisible();await page.getByLabel("Điểm tối đa",{exact:true}).first().fill("60");
  await page.getByRole("tab",{name:"Bài thi",exact:true}).click();await expect(page.getByLabel("Đáp án đúng",{exact:true}).first()).toHaveValue("a");
  await page.getByRole("button",{name:"Thêm câu trắc nghiệm",exact:true}).click();await page.getByRole("button",{name:"Xóa câu trắc nghiệm 3",exact:true}).click();
  await page.getByRole("button",{name:"Thêm câu tự luận",exact:true}).click();await page.getByRole("button",{name:"Xóa câu tự luận 2",exact:true}).click();
  await page.getByRole("tab",{name:"Mô tả công việc",exact:true}).click();await page.getByRole("button",{name:"Lưu nháp",exact:true}).click();await expect(page.getByText("Đã lưu bản nháp.",{exact:true})).toBeVisible();
  // Backend vẫn là nguồn validation publish; nháp cho phép giữ nội dung chưa đủ.
  await page.getByRole("tab",{name:/Tiêu chí CV/}).click();
  const guidance=page.getByLabel("Hướng dẫn chấm theo bằng chứng",{exact:true}).first();const originalGuidance=await guidance.inputValue();await guidance.fill("");
  await page.getByRole("button",{name:"Lưu nháp",exact:true}).click();await expect(page.getByText("Đã lưu bản nháp.",{exact:true})).toBeVisible();
  await page.getByRole("tab",{name:"Mô tả công việc",exact:true}).click();await page.getByRole("button",{name:"Duyệt & đăng tuyển"}).click();await page.getByRole("button",{name:"Xác nhận đăng tin",exact:true}).click();
  await expect(page.getByRole("tab",{name:/Tiêu chí CV/})).toHaveAttribute("aria-selected","true");
  await expect(page.getByLabel("Hướng dẫn chấm theo bằng chứng",{exact:true}).first()).toBeFocused();await expect(page.getByLabel("Hướng dẫn chấm theo bằng chứng",{exact:true}).first()).toHaveAttribute("aria-describedby","typescript-guide-error");
  await mkdir(".impeccable/review",{recursive:true});await page.screenshot({path:".impeccable/review/phase2-validation-error.png",fullPage:true,animations:"disabled"});
  await page.getByLabel("Hướng dẫn chấm theo bằng chứng",{exact:true}).first().fill(originalGuidance);await page.getByRole("button",{name:"Lưu nháp",exact:true}).click();await expect(page.getByText("Đã lưu bản nháp.",{exact:true})).toBeVisible();await page.getByRole("tab",{name:"Mô tả công việc",exact:true}).click();
  await mkdir(".impeccable/review",{recursive:true});
  await page.setViewportSize({width:1440,height:960});await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:".impeccable/review/phase2-editor-desktop.png",fullPage:true,animations:"disabled"});
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:".impeccable/review/phase2-editor-mobile.png",fullPage:true,animations:"disabled"});
  await page.getByRole("button",{name:"Duyệt & đăng tuyển"}).click();await page.getByRole("button",{name:"Xác nhận đăng tin",exact:true}).click();await expect(page).toHaveURL(/\/hr\/jobs\/[a-f0-9-]+$/);
  const id=page.url().split("/").at(-1)!;
  const guest=await browser.newContext();const publicPage=await guest.newPage();
  const response=await guest.request.get(`/api/jobs/${id}`);expect(response.status()).toBe(200);const json=await response.text();expect(json).not.toMatch(/correct_answer|scoring_guidance|q_typescript|q_test|e_api/);
  await publicPage.goto("/jobs");await publicPage.getByLabel("Kỹ năng",{exact:true}).fill("typescript");await publicPage.getByLabel("Lương từ (VND/tháng)").fill("25000000");await publicPage.getByRole("button",{name:"Tìm việc làm"}).click();
  await expect(publicPage.getByRole("link",{name:"Frontend Developer — Đội sản phẩm (kiểm thử)",exact:true})).toBeVisible();
  await publicPage.setViewportSize({width:1440,height:960});await publicPage.screenshot({path:".impeccable/review/phase2-jobs-desktop.png",fullPage:true,animations:"disabled"});expect((await new AxeBuilder({page:publicPage}).withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);
  await publicPage.setViewportSize({width:390,height:844});expect(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await publicPage.screenshot({path:".impeccable/review/phase2-jobs-mobile.png",fullPage:true,animations:"disabled"});
  await publicPage.getByRole("link",{name:"Frontend Developer — Đội sản phẩm (kiểm thử)",exact:true}).click();await expect(publicPage.getByRole("heading",{name:"Frontend Developer — Đội sản phẩm (kiểm thử)",exact:true})).toBeVisible();expect(await publicPage.content()).not.toMatch(/correct_answer|scoring_guidance|q_typescript|q_test|e_api/);
  await page.getByRole("button",{name:"Đóng tuyển",exact:true}).click();await page.getByRole("button",{name:"Xác nhận đóng tuyển",exact:true}).click();await expect(page.getByText("Đã đóng",{exact:true})).toBeVisible();expect((await guest.request.get(`/api/jobs/${id}`)).status()).toBe(404);
  await publicPage.goto("/jobs?q=frontend");await expect(publicPage.getByRole("heading",{name:"Chưa tìm thấy vị trí phù hợp."})).toBeVisible();await guest.close();
});

test("AI JSON lỗi có thể retry, tải lại không mất task hoặc tạo trùng",async({page})=>{
  await loginHR(page);await page.goto("/hr/jobs/new");
  await page.getByLabel("Bạn đang tìm người như thế nào?").fill(`E2E_FAIL_ONCE ${crypto.randomUUID()} Tuyển lập trình viên TypeScript cần kiểm thử.`);
  await page.getByRole("button",{name:"Tạo bản nháp bằng AI"}).click();await expect(page).toHaveURL(/\/edit$/);await page.reload();
  await expect(page.getByText("Chưa thể hoàn tất bản nháp",{exact:true})).toBeVisible({timeout:20000});
  const id=page.url().split("/").at(-2)!;const first=await (await page.request.get(`/api/hr/jobs/${id}`)).json();expect(first.task.error_code).toBe("INVALID_JSON");expect(first.task.attempt).toBe(1);
  await page.getByRole("button",{name:"Thử lại",exact:true}).click();await expect(page.getByText("Bản nháp AI đã sẵn sàng",{exact:true})).toBeVisible({timeout:20000});
  const next=await (await page.request.get(`/api/hr/jobs/${id}`)).json();expect(next.task.id).not.toBe(first.task.id);expect(next.job.status).toBe("DRAFT");
  const old=await (await page.request.get(`/api/tasks/${first.task.id}`)).json();expect(old.state).toBe("FAILED");expect(old.can_retry).toBe(false);
});

test("API idempotent và chặn chủ tin giả; draft không xuất hiện công khai",async({page,browser})=>{
  await loginHR(page);const key=crypto.randomUUID();const input={raw_hr_prompt:"Tin nháp soạn thủ công để kiểm thử",generate:false};
  const send=()=>page.request.post("/api/hr/jobs",{headers:{Origin:origin,"Idempotency-Key":key},data:input});
  const responses=await Promise.all([send(),send()]);expect(responses.map(r=>r.status())).toEqual([201,201]);const first=await responses[0].json(),second=await responses[1].json();expect(first.job_id).toBe(second.job_id);expect(first.task_id).toBeNull();
  expect((await page.request.get(`/api/jobs/${first.job_id}`)).status()).toBe(404);
  const conflict=await page.request.post("/api/hr/jobs",{headers:{Origin:origin,"Idempotency-Key":key},data:{...input,raw_hr_prompt:"Nội dung khác"}});expect(conflict.status()).toBe(409);
  const other=await browser.newContext();await other.request.post(`${origin}/api/auth/login`,{headers:{Origin:origin},data:{email:"candidate-b@example.test",password:"e2e-only-passphrase-2026"}});
  expect((await other.request.get(`${origin}/api/hr/jobs/${first.job_id}`)).status()).toBe(404);
  expect((await other.request.post(`${origin}/api/hr/jobs/${first.job_id}/publish`,{headers:{Origin:origin},data:{expected_version:1}})).status()).toBe(404);
  expect((await page.request.post(`/api/hr/jobs/${first.job_id}/publish`,{headers:{Origin:origin},data:{expected_version:1}})).status()).toBe(422);
  await other.close();
});
