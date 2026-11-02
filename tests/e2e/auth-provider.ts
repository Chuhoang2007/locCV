// HTTP fixture cho Playwright. Không được import từ src/ hoặc dùng làm Auth production.
// Cookie/SDK/API ứng dụng vẫn chạy nguyên bản; chỉ Supabase provider được giả lập.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createTestDatabase } from "../helpers/database";
import { sqlRPC } from "../helpers/queue";

const db=await createTestDatabase();
const rpcFunctions=(await db.query<{name:string;args:string[]}>(`select p.proname as name,coalesce(p.proargnames,array[]::text[]) as args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'lc_%'`)).rows;
const columns=new Map<string,Set<string>>();
for(const table of ["users","jobs","ai_tasks","applications","cv_uploads"]){const {rows}=await db.query<{column_name:string}>("select column_name from information_schema.columns where table_schema='public' and table_name=$1",[table]);columns.set(table,new Set(rows.map(r=>r.column_name)));}

const publicKey = "sb_publishable_phase1_fixture";
const secretKey = "sb_secret_phase1_fixture_only";
type FixtureUser = { id: string; email: string; password: string; display_name: string; confirmed: boolean };
type FixtureProfile = { id: string; display_name: string; preferred_mode: "HR" | "CANDIDATE"; timezone: string; created_at: string; updated_at: string };
const users = new Map<string, FixtureUser>();
const profiles = new Map<string, FixtureProfile>();
const access = new Map<string, string>();
const refresh = new Map<string, string>();
const storedFiles=new Map<string,Buffer>();
const signedFiles=new Map<string,{path:string;expires:number}>();
function addUser(email: string, displayName: string, id = randomUUID(), confirmed = true) {
  const timestamp = new Date().toISOString();
  const user: FixtureUser = { id, email, password: "e2e-only-passphrase-2026", display_name: displayName, confirmed };
  users.set(email, user);
  profiles.set(id, { id, display_name: displayName, preferred_mode: "CANDIDATE", timezone: "Asia/Bangkok", created_at: timestamp, updated_at: timestamp });
  return user;
}
function reset() {
  users.clear(); profiles.clear(); access.clear(); refresh.clear();storedFiles.clear();signedFiles.clear();
  addUser("hr-a@example.test", "Minh Anh (kiểm thử)", "11111111-1111-4111-8111-111111111111");
  addUser("candidate-b@example.test", "Ứng viên B (kiểm thử)", "22222222-2222-4222-8222-222222222222");
  addUser("other-c@example.test","Người ngoài C (kiểm thử)","33333333-3333-4333-8333-333333333333");
}
reset();
async function resetDatabase(){
  reset();
  await db.exec("truncate public.cv_uploads,public.audit_events,public.idempotency_keys,public.messages,public.ai_tasks,public.applications,public.jobs,auth.users cascade;");
  await db.exec(await readFile("supabase/seed.sql","utf8"));
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",["33333333-3333-4333-8333-333333333333","other-c@example.test",JSON.stringify({display_name:"Người ngoài C (kiểm thử)"})]);
  for(const profile of profiles.values())await db.query("update public.users set display_name=$1,preferred_mode=$2 where id=$3",[profile.display_name,profile.preferred_mode,profile.id]);
}
await resetDatabase();
function userPayload(user: FixtureUser) {
  return { id: user.id, aud: "authenticated", role: "authenticated", email: user.email,
    email_confirmed_at: user.confirmed ? new Date().toISOString() : undefined,
    app_metadata: { provider: "email", providers: ["email"] }, user_metadata: { display_name: user.display_name },
    identities: [], created_at: "2026-01-01T00:00:00Z", updated_at: new Date().toISOString() };
}
function session(user: FixtureUser) {
  const iat = Math.floor(Date.now() / 1000);
  const head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: user.id, email: user.email, aud: "authenticated", role: "authenticated", iat, exp: iat + 3600, jti: randomUUID() })).toString("base64url");
  const signature = createHmac("sha256", "fixture-signing-key-only").update(`${head}.${payload}`).digest("base64url");
  const token = `${head}.${payload}.${signature}`;
  const refreshToken = randomUUID(); access.set(token, user.email); refresh.set(refreshToken, user.email);
  return { access_token: token, refresh_token: refreshToken, token_type: "bearer", expires_in: 3600, expires_at: iat + 3600, user: userPayload(user) };
}
function respond(res: ServerResponse, status: number, body?: unknown) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Supabase-Api-Version": "2024-01-01" });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}
async function bodyOf(req: IncomingMessage) {
  let data = ""; for await (const chunk of req) data += chunk;
  return data ? JSON.parse(data) as Record<string, unknown> : {};
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1:54329");
    if (url.pathname === "/health") return respond(res, 200, { fixture: true });
    if (url.pathname === "/__test/reset" && req.method === "POST") { await resetDatabase(); return respond(res, 200, {}); }
    if(url.pathname==="/__test/expire-links"&&req.method==="POST"){for(const signed of signedFiles.values())signed.expires=0;return respond(res,200,{});}
    if(url.pathname==="/__test/expire-interview"&&req.method==="POST"){
      const body=await bodyOf(req);const id=String(body.application_id);if(!/^[a-f0-9-]{36}$/.test(id))return respond(res,400,{});
      await db.exec("alter table public.applications disable trigger applications_guard");
      try{await db.query("update public.applications set interview_started_at=interview_started_at-interval '3 hours',interview_deadline_at=interview_deadline_at-interval '3 hours' where id=$1 and interview_submitted_at is null",[id]);}
      finally{await db.exec("alter table public.applications enable trigger applications_guard");}
      return respond(res,200,{});
    }
    const token = req.headers.authorization?.replace(/^Bearer /i, "");
    const current = users.get(access.get(token ?? "") ?? "");
    if(url.pathname.startsWith("/storage/v1/")){
      const path=url.pathname.slice("/storage/v1/".length);
      if(path.startsWith("object/sign/")&&req.method==="GET"){
        const signed=signedFiles.get(url.searchParams.get("token")??"");
        if(!signed||signed.expires<=Date.now()||signed.path!==path.slice("object/sign/".length))return respond(res,403,{message:"Expired signed URL"});
        const bytes=storedFiles.get(signed.path);if(!bytes)return respond(res,404,{message:"Not found"});
        res.writeHead(200,{"Content-Type":"application/octet-stream"});return res.end(bytes);
      }
      if(req.headers.apikey!==secretKey||token!==secretKey)return respond(res,403,{message:"Denied"});
      if(path.startsWith("object/sign/")&&req.method==="POST"){
        const body=await bodyOf(req);const objectPath=path.slice("object/sign/".length);
        if(!storedFiles.has(objectPath)||body.expiresIn!==60)return respond(res,400,{message:"Bad signed URL request"});
        const signedToken=randomUUID();signedFiles.set(signedToken,{path:objectPath,expires:Date.now()+60000});
        return respond(res,200,{signedURL:`/object/sign/${objectPath}?token=${signedToken}`});
      }
      if(path.startsWith("object/")&&req.method==="POST"){
        const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const bytes=Buffer.concat(chunks);
        storedFiles.set(path.slice("object/".length),bytes);return respond(res,200,{Key:path.slice("object/".length),Id:randomUUID()});
      }
      if(path.startsWith("object/")&&req.method==="GET"){
        const bytes=storedFiles.get(path.slice("object/".length));if(!bytes)return respond(res,404,{message:"Not found"});
        res.writeHead(200,{"Content-Type":"application/octet-stream"});return res.end(bytes);
      }
      return respond(res,404,{message:"Unknown storage operation"});
    }
    const body = req.method === "POST" || req.method === "PUT" || req.method === "PATCH" ? await bodyOf(req) : {};
    if (url.pathname === "/auth/v1/token") {
      const grant = url.searchParams.get("grant_type");
      const user = users.get(grant === "refresh_token" ? (refresh.get(String(body.refresh_token)) ?? "") : String(body.email));
      if (!user || (grant === "password" && user.password !== body.password)) return respond(res, 400, { code: "invalid_credentials", msg: "Invalid login credentials" });
      if (!user.confirmed) return respond(res, 400, { code: "email_not_confirmed", msg: "Email not confirmed" });
      return respond(res, 200, session(user));
    }
    if (url.pathname === "/auth/v1/signup") {
      const email = String(body.email);
      const metadata = body.data as Record<string, string>;
      const existing=users.get(email);
      const user = existing ?? addUser(email, metadata?.display_name ?? "Thành viên mới", randomUUID(), false);
      if(!existing)await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",[user.id,email,JSON.stringify({display_name:user.display_name})]);
      user.password = String(body.password);
      return respond(res, 200, { user: userPayload(user), session: null });
    }
    if (url.pathname === "/auth/v1/verify") {
      const hash = String(body.token_hash);
      const email = hash.replace(/^(email|recovery):/, "");
      const user = users.get(email);
      if (!user || !/^(email|recovery):/.test(hash)) return respond(res, 403, { code: "otp_expired", msg: "Expired fixture token" });
      user.confirmed = true; return respond(res, 200, session(user));
    }
    if (url.pathname === "/auth/v1/recover") return respond(res, 200, {});
    if (url.pathname === "/auth/v1/user") {
      if (!current) return respond(res, 401, { code: "bad_jwt", msg: "Invalid JWT" });
      if (req.method === "PUT" && typeof body.password === "string") current.password = body.password;
      return respond(res, 200, userPayload(current));
    }
    if (url.pathname === "/auth/v1/logout") {
      if (url.searchParams.get("scope") === "global" && current) {
        for (const [key,email] of access) if (email === current.email) access.delete(key);
        for (const [key,email] of refresh) if (email === current.email) refresh.delete(key);
      } else if (token) access.delete(token);
      return respond(res, 204);
    }
    if (url.pathname === "/auth/v1/.well-known/jwks.json") return respond(res, 200, { keys: [] });
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      if (req.headers.apikey !== secretKey || token !== secretKey) return respond(res, 403, { code: "42501", message: "Direct client access denied" });
      const name=url.pathname.slice("/rest/v1/rpc/".length);const definition=rpcFunctions.find(f=>f.name===name);
      if(!definition || Object.keys(body).some(key=>!definition.args.includes(key)) || definition.args.some(key=>!(key in body)))return respond(res,400,{code:"PGRST202",message:"Unknown RPC arguments"});
      const args=Object.fromEntries(definition.args.map(key=>[key,body[key]]));
      try{return respond(res,200,await sqlRPC(db,name,args));}catch(e){return respond(res,400,{code:"P0001",message:e instanceof Error?e.message:"RPC_ERROR"});}
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      if (req.headers.apikey !== secretKey || token !== secretKey) return respond(res, 403, { code: "42501", message: "Direct client access denied" });
      const table=url.pathname.slice("/rest/v1/".length),allowed=columns.get(table);
      if(!allowed)return respond(res,404,{code:"FIXTURE_TABLE_UNKNOWN"});
      const selected=url.searchParams.get("select")?.split(",")??[...allowed];
      if(selected.some(name=>!allowed.has(name)))return respond(res,400,{code:"FIXTURE_BAD_COLUMN"});
      const values:unknown[]=[];const where:string[]=[];
      for(const [key,value] of url.searchParams){if(["select","order","limit"].includes(key))continue;if(!allowed.has(key)||!value.startsWith("eq."))return respond(res,400,{code:"FIXTURE_BAD_FILTER"});values.push(value.slice(3));where.push(`"${key}"=$${values.length}`);}
      const order=(url.searchParams.get("order")??"").split(",").filter(Boolean).map(value=>{const [name,direction]=value.split(".");if(!allowed.has(name)||!["asc","desc"].includes(direction))throw new Error("BAD_ORDER");return `"${name}" ${direction}`;});
      const limit=Number(url.searchParams.get("limit")??100);if(!Number.isInteger(limit)||limit<1||limit>100)return respond(res,400,{code:"BAD_LIMIT"});
      let result;
      if(req.method==="PATCH"&&["users","cv_uploads"].includes(table)){
        const keys=Object.keys(body);if(keys.some(k=>!(table==="users"?["display_name","preferred_mode","timezone"]:["state"]).includes(k)))return respond(res,400,{code:"BAD_PATCH"});
        const updates=keys.map(key=>{values.push(body[key]);return `"${key}"=$${values.length}`;});
        result=await db.query<Record<string,unknown>>(`update public."${table}" set ${updates.join(",")} ${where.length?"where "+where.join(" and "):""} returning ${selected.map(c=>`"${c}"`).join(",")}`,values);
      }else result=await db.query<Record<string,unknown>>(`select ${selected.map(c=>`"${c}"`).join(",")} from public."${table}" ${where.length?"where "+where.join(" and "):""} ${order.length?"order by "+order.join(","):""} limit ${limit}`,values);
      const output=result.rows.map(row=>table==="applications"&&row.interview_score!=null?{...row,interview_score:Number(row.interview_score)}:row);
      return respond(res,200,req.headers.accept?.includes("application/vnd.pgrst.object+json")?(output[0]??null):output);
    }
    // Các endpoint khác không được fixture âm thầm cho qua.
    return respond(res, 404, { code: "FIXTURE_NOT_IMPLEMENTED", path: url.pathname, publicKey });
  } catch { respond(res, 500, { code: "FIXTURE_ERROR" }); }
});
server.listen(54329, "127.0.0.1", () => console.log("Auth fixture ready on http://127.0.0.1:54329"));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.close(() => {void db.close().finally(()=>process.exit(0));}));
