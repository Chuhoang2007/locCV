import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicEnv, getServerEnv } from "@/lib/env";
import { assertSameOrigin, errorResponse, readJSON } from "@/server/http";

afterEach(() => vi.unstubAllEnvs());
describe("Ranh giới secret và HTTP", () => {
  it("thiếu cấu hình không âm thầm dùng tài khoản giả", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","");
    expect(()=>getPublicEnv()).toThrow();
  });
  it("chặn secret key và legacy service_role trong biến public", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://example.supabase.co");
    for (const key of ["sb_secret_private","eyJ."+Buffer.from(JSON.stringify({role:"service_role"})).toString("base64url")+".signature"]) {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",key);
      expect(()=>getPublicEnv()).toThrow();
    }
  });
  it("server env không đưa secret vào object public", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","sb_publishable_test");
    vi.stubEnv("SUPABASE_SECRET_KEY","server-secret-sentinel");
    expect(JSON.stringify(getPublicEnv())).not.toContain("server-secret-sentinel");
    expect(getServerEnv().secret).toBe("server-secret-sentinel");
  });
  it("mutation bắt buộc đúng Origin", () => {
    vi.stubEnv("SITE_URL","http://127.0.0.1:3000");
    expect(()=>assertSameOrigin(new Request("http://127.0.0.1:3000/api/me",{headers:{Origin:"https://evil.test"}}))).toThrow();
    expect(()=>assertSameOrigin(new Request("http://127.0.0.1:3000/api/me"))).toThrow();
    expect(()=>assertSameOrigin(new Request("http://127.0.0.1:3000/api/me",{headers:{Origin:"http://127.0.0.1:3000"}}))).not.toThrow();
  });
  it("local preview accepts localhost and 127.0.0.1 on its configured port, including production preview",()=>{
    vi.stubEnv("NODE_ENV","production");
    for(const configured of ["http://127.0.0.1:3000","http://localhost:3000"]){
      vi.stubEnv("SITE_URL",configured);
      for(const host of ["127.0.0.1","localhost"]){const origin=`http://${host}:3000`;
        expect(()=>assertSameOrigin(new Request(origin+"/api/me",{headers:{Origin:origin,"Sec-Fetch-Site":"same-origin"}}))).not.toThrow();
      }
    }
  });
  it("local aliases never trust other sites, ports, schemes, destinations or cross-site requests",()=>{
    vi.stubEnv("SITE_URL","http://127.0.0.1:3000");
    for(const origin of ["null","https://localhost:3000","http://localhost:3001","http://localhost.evil.test:3000","http://127.0.0.2:3000"])
      expect(()=>assertSameOrigin(new Request("http://localhost:3000/api/me",{headers:{Origin:origin}}))).toThrow();
    expect(()=>assertSameOrigin(new Request("http://evil.test:3000/api/me",{headers:{Origin:"http://localhost:3000","X-Forwarded-Host":"localhost:3000"}}))).toThrow();
    expect(()=>assertSameOrigin(new Request("http://localhost:3000/api/me",{headers:{Origin:"http://localhost:3000","Sec-Fetch-Site":"cross-site"}}))).toThrow();
  });
  it("local development accepts its actual port, while production and cross-port requests remain blocked",()=>{
    vi.stubEnv("SITE_URL","http://127.0.0.1:3000");
    vi.stubEnv("NODE_ENV","development");
    for(const hostname of ["127.0.0.1","localhost"]){
      const origin=`http://${hostname}:3001`;
      expect(()=>assertSameOrigin(new Request(origin+"/api/me",{headers:{Origin:origin,"Sec-Fetch-Site":"same-origin"}}))).not.toThrow();
    }
    for(const origin of ["http://127.0.0.1:3000","http://localhost:3002"])
      expect(()=>assertSameOrigin(new Request("http://127.0.0.1:3001/api/me",{headers:{Origin:origin}}))).toThrow();
    expect(()=>assertSameOrigin(new Request("http://127.0.0.1:3001/api/me",{headers:{Origin:"http://localhost:3001","Sec-Fetch-Site":"cross-site"}}))).toThrow();
    vi.stubEnv("NODE_ENV","production");
    expect(()=>assertSameOrigin(new Request("http://127.0.0.1:3001/api/me",{headers:{Origin:"http://127.0.0.1:3001"}}))).toThrow();
  });
  it("public deployments require the configured origin even with local or spoofed forwarded hosts",()=>{
    vi.stubEnv("SITE_URL","https://loccv.example.test");
    expect(()=>assertSameOrigin(new Request("https://loccv.example.test/api/me",{headers:{Origin:"https://loccv.example.test"}}))).not.toThrow();
    for(const origin of ["http://localhost:3000","http://127.0.0.1:3000","https://evil.test"])
      expect(()=>assertSameOrigin(new Request("http://localhost:3000/api/me",{headers:{Origin:origin,"X-Forwarded-Host":"loccv.example.test"}}))).toThrow();
  });
  it("giới hạn body ngay cả khi không có Content-Length",async()=>{
    const request = new Request("http://local/api",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({value:"x".repeat(9000)})});
    await expect(readJSON(request)).rejects.toMatchObject({status:413});
  });
  it("không phản chiếu lỗi thô ra API",async()=>{
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    const response=errorResponse(new Error("private-key-and-cv-sentinel"));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private-key-and-cv-sentinel");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    log.mockRestore();
  });
});
