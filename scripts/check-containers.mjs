// Linux/Docker CI smoke; uses only the synthetic provider, never .env.local.
import { spawn,execFileSync } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
const origin="http://127.0.0.1:3001",provider="http://127.0.0.1:54329";
const publicKey="sb_publishable_phase1_fixture",secret="sb_secret_phase1_fixture_only";
const names=[`loccv-web-smoke-${process.pid}`,`loccv-worker-smoke-${process.pid}`];
const command=(args)=>execFileSync("docker",args,{stdio:"inherit"});
async function ready(url){for(let i=0;i<90;i++){try{if((await fetch(url,{signal:AbortSignal.timeout(2000)})).ok)return;}catch{}await wait(1000);}throw new Error("CONTAINER_NOT_READY");}
const adapter=spawn(process.execPath,["--import","tsx","tests/e2e/auth-provider.ts"],{stdio:["ignore","ignore","inherit"]});
try{
  await ready(provider+"/health");
  command(["build","-f","Dockerfile.web","--build-arg",`NEXT_PUBLIC_SUPABASE_URL=${provider}`,"--build-arg",`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publicKey}`,"-t","loccv-web:smoke","."]);
  command(["build","-f","Dockerfile.worker","-t","loccv-worker:smoke","."]);
  const env=["NEXT_PUBLIC_SUPABASE_URL="+provider,"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="+publicKey,"SUPABASE_SECRET_KEY="+secret,"SITE_URL="+origin,"NINE_ROUTER_BASE_URL=https://fixture.nine.test/v1","NINE_ROUTER_API_KEY=synthetic-only","NINE_ROUTER_MODEL=fixture","DATA_RETENTION_ENABLED=false"];
  for(let i=0;i<names.length;i++)command(["run","--detach","--network","host","--read-only","--tmpfs","/tmp:rw,size=64m,mode=1777","--cap-drop","ALL","--security-opt","no-new-privileges","--name",names[i],...env.flatMap(x=>["-e",x]),"-e",i===0?"PORT=3001":"WORKER_HEALTH_PORT=3311",i===0?"loccv-web:smoke":"loccv-worker:smoke"]);
  await Promise.all([ready(origin+"/api/health"),ready("http://127.0.0.1:3311/health")]);
  if(!(await fetch(origin+"/login")).ok)throw new Error("WEB_LOGIN_UNAVAILABLE");
  // Sign in through the actual container; check the parser's traced files and runtime deps.
  const auth=await fetch(origin+"/api/auth/login",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({email:"candidate-b@example.test",password:"e2e-only-passphrase-2026"}),redirect:"manual"});
  if(!auth.ok)throw new Error("CONTAINER_AUTH_FAILED");
  const cookie=auth.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
  const {readFile}=await import("node:fs/promises");
  const upload=await fetch(origin+"/api/cv/uploads",{method:"POST",headers:{Origin:origin,Cookie:cookie,"Content-Type":"application/pdf"},body:await readFile("tests/fixtures/cv-valid.pdf")});
  if(!upload.ok)throw new Error("CONTAINER_UPLOAD_FAILED");const {upload_id}=await upload.json();
  const extract=await fetch(origin+"/api/cv/extract",{method:"POST",headers:{Origin:origin,Cookie:cookie,"Content-Type":"application/json"},body:JSON.stringify({upload_id})});
  if(!extract.ok||!(await extract.json()).text)throw new Error("CONTAINER_PARSER_FAILED");
  command(["stop","--time","15",names[1]]);
  if(execFileSync("docker",["inspect","--format","{{.State.ExitCode}}",names[1]],{encoding:"utf8"}).trim()!=="0")throw new Error("WORKER_SHUTDOWN_NOT_CLEAN");
  console.log(JSON.stringify({ok:true,web_readiness:true,worker_readiness:true,parser:true,graceful_shutdown:true}));
}finally{
  for(const name of names)try{execFileSync("docker",["rm","--force",name],{stdio:"ignore"});}catch{}
  adapter.kill("SIGTERM");
}
