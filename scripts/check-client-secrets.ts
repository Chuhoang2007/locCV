import { existsSync } from "node:fs";
import { readdir,readFile } from "node:fs/promises";
import { join } from "node:path";
if(existsSync(".env.local"))process.loadEnvFile(".env.local");
const secrets=[process.env.SUPABASE_SECRET_KEY,process.env.NINE_ROUTER_API_KEY].filter((v):v is string=>!!v&&v.length>=8);
let files=0;const failures:string[]=[];
async function visit(dir:string){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await visit(path);else if(/\.(js|json|map)$/.test(entry.name)){files++;const text=await readFile(path,"utf8");if(secrets.some(value=>text.includes(value)))failures.push(path);}}}
await visit(".next/static");
console.log(JSON.stringify({ok:failures.length===0,scanned_files:files,configured_secrets:secrets.length}));
if(failures.length){console.error("Server secret found in client assets. Do not publish this build.");process.exitCode=1;}
