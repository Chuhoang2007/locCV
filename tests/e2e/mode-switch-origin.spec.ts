import { test,expect } from "@playwright/test";
const provider="http://127.0.0.1:54329";
test.beforeEach(async({request})=>{await request.post(provider+"/__test/reset");});
for(const hostname of ["127.0.0.1","localhost"])test(`role switch works in both directions at ${hostname} without weakening origin checks`,async({browser,baseURL})=>{
  const origin=`http://${hostname}:${new URL(baseURL!).port}`,context=await browser.newContext({baseURL:origin});const page=await context.newPage();
  try{
    await page.goto("/login");await page.getByLabel("Địa chỉ email").fill("hr-a@example.test");await page.getByLabel("Mật khẩu",{exact:true}).fill("e2e-only-passphrase-2026");await page.getByRole("button",{name:"Đăng nhập",exact:true}).click();await expect(page).toHaveURL(origin+"/settings");
    await page.getByRole("button",{name:"Tuyển dụng",exact:true}).click();await expect(page.getByRole("button",{name:"Tuyển dụng",exact:true})).toHaveAttribute("aria-pressed","true");await page.goto("/hr");
    await page.getByRole("button",{name:"Ứng viên",exact:true}).click();await expect(page).toHaveURL(origin+"/candidate/applications");await expect(page.getByRole("button",{name:"Ứng viên",exact:true})).toHaveAttribute("aria-pressed","true");
    await page.reload();const before=await (await page.request.get("/api/me")).json();expect(before.profile.preferred_mode).toBe("CANDIDATE");
    const rejected=await page.request.patch("/api/me",{headers:{Origin:"https://evil.test","Sec-Fetch-Site":"cross-site"},data:{preferred_mode:"HR"}});expect(rejected.status()).toBe(403);expect((await rejected.json()).error.code).toBe("INVALID_ORIGIN");
    expect((await (await page.request.get("/api/me")).json()).profile.preferred_mode).toBe("CANDIDATE");
    await page.getByRole("button",{name:"Tuyển dụng",exact:true}).click();await expect(page).toHaveURL(origin+"/hr");await expect(page.getByRole("button",{name:"Tuyển dụng",exact:true})).toHaveAttribute("aria-pressed","true");
    const after=await (await page.request.get("/api/me")).json();expect(after.id).toBe(before.id);expect(after.profile.preferred_mode).toBe("HR");await expect(page.getByRole("alert").filter({hasText:"Yêu cầu không hợp lệ"})).toHaveCount(0);
  }finally{await context.close();}
});
