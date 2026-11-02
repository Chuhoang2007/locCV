import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

test.beforeEach(async ({ request }) => { await request.post("http://127.0.0.1:54329/__test/reset"); });
const password = "e2e-only-passphrase-2026";

test("giao diện đăng nhập responsive, label, validation và accessibility",async({page})=>{
  await page.goto("/login");
  await expect(page.getByRole("heading",{name:"Chào bạn trở lại."})).toBeVisible();
  await mkdir(".impeccable/review",{recursive:true});
  await page.setViewportSize({width:1440,height:960});
  await page.screenshot({path:".impeccable/review/desktop.png",fullPage:true,animations:"disabled"});
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:".impeccable/review/mobile.png",fullPage:true,animations:"disabled"});
  await page.getByRole("button",{name:"Đăng nhập",exact:true}).click();
  await expect(page.getByText("Email chưa đúng định dạng.")).toBeVisible();
  await page.getByLabel("Địa chỉ email",{exact:true}).fill("hr-a@example.test");
  await page.getByLabel("Mật khẩu",{exact:true}).fill("wrong-password");
  await page.getByRole("button",{name:"Hiện mật khẩu"}).click();
  await expect(page.getByLabel("Mật khẩu",{exact:true})).toHaveAttribute("type","text");
  await page.getByRole("button",{name:"Đăng nhập",exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:"Email hoặc mật khẩu chưa đúng"})).toBeVisible();
});

test("đăng nhập, sửa hồ sơ, đổi hai mode giữ UUID, đăng xuất khóa trang riêng",async({page})=>{
  await page.goto("/login");
  await page.getByLabel("Địa chỉ email",{exact:true}).fill("hr-a@example.test");
  await page.getByLabel("Mật khẩu",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Đăng nhập",exact:true}).click();
  await expect(page).toHaveURL(/\/settings$/);
  const before=await (await page.request.get("/api/me")).json();
  expect(before.id).toBe("11111111-1111-4111-8111-111111111111");
  await page.getByLabel("Tên hiển thị",{exact:true}).fill("Minh Anh — kiểm thử");
  await page.getByRole("button",{name:"Lưu thay đổi"}).click();
  await expect(page.getByText("Đã lưu thay đổi.")).toBeVisible();
  await page.getByRole("button",{name:"Tuyển dụng",exact:true}).click();
  await expect(page.getByRole("button",{name:"Tuyển dụng",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.reload();
  const after=await (await page.request.get("/api/me")).json();
  expect(after.id).toBe(before.id);expect(after.profile.preferred_mode).toBe("HR");
  expect(after.profile.display_name).toBe("Minh Anh — kiểm thử");
  await page.setViewportSize({width:1440,height:960});
  await page.screenshot({path:".impeccable/review/settings-desktop.png",fullPage:true,animations:"disabled"});
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:".impeccable/review/settings-mobile.png",fullPage:true,animations:"disabled"});
  await page.getByRole("button",{name:"Ứng viên",exact:true}).click();
  await expect(page.getByRole("button",{name:"Ứng viên",exact:true})).toHaveAttribute("aria-pressed","true");
  expect((await (await page.request.get("/api/me")).json()).id).toBe(before.id);
  await page.getByRole("link",{name:"Hồ sơ ứng tuyển",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Hồ sơ ứng tuyển",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Tuyển dụng",exact:true}).click();
  await expect(page).toHaveURL(/\/hr$/);
  await page.getByRole("button",{name:"Đăng xuất",exact:true}).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/me")).status()).toBe(401);
  await page.goto("/settings");await expect(page).toHaveURL(/\/login$/);
});

test("tạo tài khoản và xác nhận email qua server callback",async({page})=>{
  const email="new-member@example.test";
  await page.goto("/signup");
  await page.getByLabel("Tên hiển thị").fill("Thành viên mới — kiểm thử");
  await page.getByLabel("Địa chỉ email").fill(email);
  await page.getByLabel("Mật khẩu",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Tạo tài khoản",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Hãy kiểm tra email."})).toBeVisible();
  await page.goto(`/auth/confirm?token_hash=${encodeURIComponent("email:"+email)}&type=email`);
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading",{name:"Thành viên mới — kiểm thử"})).toBeVisible();
});

test("khôi phục và đổi mật khẩu, sau đó đăng nhập bằng mật khẩu mới",async({page})=>{
  await page.goto("/forgot-password");
  await page.getByLabel("Địa chỉ email").fill("hr-a@example.test");
  await page.getByRole("button",{name:"Gửi liên kết khôi phục"}).click();
  await expect(page.getByRole("heading",{name:"Hãy kiểm tra email."})).toBeVisible();
  await page.goto(`/auth/confirm?token_hash=${encodeURIComponent("recovery:hr-a@example.test")}&type=recovery`);
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel("Mật khẩu mới",{exact:true}).fill("new-e2e-passphrase-2026");
  await page.getByLabel("Nhập lại mật khẩu mới",{exact:true}).fill("new-e2e-passphrase-2026");
  await page.getByRole("button",{name:"Lưu mật khẩu mới"}).click();
  await expect(page).toHaveURL(/\/login\?updated=1$/);
  await page.getByLabel("Địa chỉ email").fill("hr-a@example.test");
  await page.getByLabel("Mật khẩu",{exact:true}).fill("new-e2e-passphrase-2026");
  await page.getByRole("button",{name:"Đăng nhập",exact:true}).click();
  await expect(page).toHaveURL(/\/settings$/);
});

test("API chặn actor giả, CSRF và phiên không tồn tại",async({page})=>{
  await page.goto("/login");
  await page.getByLabel("Địa chỉ email").fill("hr-a@example.test");
  await page.getByLabel("Mật khẩu",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Đăng nhập",exact:true}).click();
  await expect(page).toHaveURL(/\/settings$/);
  const forged=await page.request.patch("/api/me",{headers:{Origin:"http://127.0.0.1:3000"},data:{id:"22222222-2222-4222-8222-222222222222",display_name:"Hijack"}});
  expect(forged.status()).toBe(400);
  const csrf=await page.request.patch("/api/me",{headers:{Origin:"https://evil.test"},data:{preferred_mode:"HR"}});
  expect(csrf.status()).toBe(403);
  const viewer=await (await page.request.get("/api/me?id=22222222-2222-4222-8222-222222222222")).json();
  expect(viewer.id).toBe("11111111-1111-4111-8111-111111111111");
  expect(JSON.stringify(viewer)).not.toMatch(/sb_secret_|correct_answer|scoring_rubric|cv_text/);
});

test("cookie giả không cấp quyền và link email sai không lộ token",async({page,context})=>{
  await context.addCookies([{name:"sb-127-auth-token",value:"base64-"+Buffer.from(JSON.stringify({access_token:"forged.token.signature",refresh_token:"forged",user:{id:"11111111-1111-4111-8111-111111111111"}})).toString("base64url"),domain:"127.0.0.1",path:"/"}]);
  await page.goto("/settings");await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/me")).status()).toBe(401);
  await context.clearCookies();
  await page.goto("/auth/confirm?token_hash=invalid-private-token&type=email");
  await expect(page).toHaveURL(/\/login\?link_error=1$/);
  expect(await page.content()).not.toContain("invalid-private-token");
});
