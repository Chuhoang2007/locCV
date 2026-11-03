import { test,expect,type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
const provider="http://127.0.0.1:54329",origin="http://127.0.0.1:3000";
const headers={Origin:origin};
function gate(){let release!:()=>void;const wait=new Promise<void>(resolve=>{release=resolve;});return {wait,release};}
async function login(page:Page){await page.goto("/login");await page.getByLabel("Địa chỉ email").fill("hr-a@example.test");await page.getByLabel("Mật khẩu",{exact:true}).fill("e2e-only-passphrase-2026");await page.getByRole("button",{name:"Đăng nhập",exact:true}).click();await expect(page).toHaveURL(/\/settings$/);await expect(page.getByRole("heading",{name:"Cài đặt tài khoản",exact:true})).toBeVisible();await expect(page.getByTestId("navigation-feedback")).toHaveCount(0);}
async function capture(page:Page,name:string){await mkdir(".impeccable/review",{recursive:true});for(const [size,width,height] of [["desktop",1440,960],["mobile",390,844]] as const){await page.setViewportSize({width,height});await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.impeccable/review/loading-${name}-${size}.png`,fullPage:true});expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);}}
test.beforeEach(async({request})=>{await request.post(provider+"/__test/reset");});

test("internal navigation acknowledges pending RSC, then clears; same-page and hash links do not get stuck",async({page})=>{
  await login(page);const held=gate();await page.route(url=>url.pathname==="/inbox",async route=>{await held.wait;await route.continue();});
  try{await page.getByRole("link",{name:"Hộp thư",exact:true}).click();await expect(page.getByTestId("navigation-feedback")).toBeVisible();await capture(page,"navigation");}
  finally{held.release();}
  await expect(page).toHaveURL(/\/inbox$/);await expect(page.getByRole("heading",{name:"Hộp thư đang trống",exact:true})).toBeVisible();await expect(page.getByTestId("navigation-feedback")).toHaveCount(0);
  await page.getByRole("link",{name:"Hộp thư",exact:true}).click();await expect(page.getByTestId("navigation-feedback")).toHaveCount(0);
  await page.locator(".skip-link").focus();await page.keyboard.press("Enter");await expect(page.getByTestId("navigation-feedback")).toHaveCount(0);
});

test("streaming route fallback holds loading until real data; reduced motion keeps readable feedback",async({page,request})=>{
  await login(page);await request.post(provider+"/__test/hold-inbox");
  try{
    await page.getByRole("link",{name:"Hộp thư",exact:true}).click();await expect(page.getByTestId("page-loading")).toBeVisible();await expect(page.getByTestId("navigation-feedback")).toBeVisible();await expect(page.getByRole("status").filter({hasText:"Đang tải nội dung…"})).toHaveCount(1);await capture(page,"skeleton");
    await page.emulateMedia({reducedMotion:"reduce"});await expect(page.locator(".navigation-progress > span")).toHaveCSS("animation-name","none");await expect(page.locator(".loading-skeleton span").first()).toHaveCSS("animation-name","none");await capture(page,"reduced-motion");
  }finally{await request.post(provider+"/__test/release-inbox");}
  await expect(page.getByRole("heading",{name:"Hộp thư đang trống",exact:true})).toBeVisible();await expect(page.getByTestId("navigation-feedback")).toHaveCount(0);await expect(page.getByTestId("page-loading")).toHaveCount(0);await capture(page,"settled");
});

test("manual draft button shows busy, blocks duplicate clicks, recovers from errors and hands off to navigation",async({page})=>{
  await login(page);await page.request.patch("/api/me",{headers,data:{preferred_mode:"HR"}});await page.goto("/hr/jobs/new");await expect(page.getByRole("heading",{name:"Tìm đúng người, từ một bản nháp tốt.",exact:true})).toBeVisible();
  const held=gate();let requests=0;
  await page.route("**/api/hr/jobs",async route=>{if(route.request().method()!=="POST")return route.continue();requests++;await held.wait;await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:{code:"TEMPORARILY_UNAVAILABLE",message:"Chưa kết nối được. Hãy thử lại."}})});});
  const button=page.getByRole("button",{name:"Soạn thủ công",exact:true});
  try{await button.click();await expect(button).toBeDisabled();await expect(button).toHaveAttribute("aria-busy","true");await button.evaluate(element=>{(element as HTMLButtonElement).click();(element as HTMLButtonElement).click();});expect(requests).toBe(1);await capture(page,"action");}
  finally{held.release();}
  await expect(page.getByRole("alert").filter({hasText:"Chưa kết nối được"})).toBeVisible();await expect(button).toBeEnabled();await expect(button).not.toHaveAttribute("aria-busy","true");await expect(page.getByTestId("navigation-feedback")).toHaveCount(0);
  await page.unroute("**/api/hr/jobs");await button.click();await expect(page).toHaveURL(/\/hr\/jobs\/[a-f0-9-]+\/edit$/);await expect(page.getByLabel("Tên vị trí tuyển dụng")).toBeVisible();await expect(page.getByTestId("navigation-feedback")).toHaveCount(0);
});

test("programmatic refresh reports loading until the refreshed settings arrive",async({page})=>{
  await login(page);const held=gate();await page.route(url=>url.pathname==="/settings",async route=>{await held.wait;await route.continue();});
  try{await page.getByLabel("Tên hiển thị",{exact:true}).fill("Tên kiểm thử đã lưu");await page.getByRole("button",{name:"Lưu thay đổi",exact:true}).click();await expect(page.getByTestId("navigation-feedback")).toBeVisible();}
  finally{held.release();}
  await expect(page.getByRole("heading",{name:"Tên kiểm thử đã lưu",exact:true})).toBeVisible();await expect(page.getByTestId("navigation-feedback")).toHaveCount(0);
});
