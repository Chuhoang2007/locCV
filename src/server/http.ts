import "server-only";
import { NextResponse } from "next/server";
import { getSiteOrigin } from "@/lib/env";
import { AppError } from "@/lib/errors";

export function assertSameOrigin(request: Request) {
  const origin=request.headers.get("origin");
  const configured=new URL(getSiteOrigin());
  const destination=new URL(request.url);
  const loopback=(hostname:string)=>hostname==="127.0.0.1"||hostname==="localhost";
  // Next dev may select another port when the default is occupied. In local
  // development, use the actual destination port; production previews retain
  // the configured port. Never add trusted origins from forwarded headers.
  const localConfiguration=configured.protocol==="http:"&&loopback(configured.hostname);
  const localDevelopment=localConfiguration&&process.env.NODE_ENV==="development";
  const localPort=localDevelopment?destination.port:configured.port;
  const localAlias=localConfiguration&&
    destination.protocol===configured.protocol&&destination.port===localPort&&loopback(destination.hostname)&&
    ["127.0.0.1","localhost"].some(hostname=>origin===new URL(`http://${hostname}${localPort?":"+localPort:""}`).origin);
  const configuredOrigin=origin===configured.origin&&!localDevelopment;
  if (!configuredOrigin&&!localAlias) throw new AppError("INVALID_ORIGIN", 403, "Yêu cầu không hợp lệ. Hãy tải lại trang rồi thử lại.");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") throw new AppError("INVALID_ORIGIN", 403, "Yêu cầu không hợp lệ.");
}

export async function readBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new AppError("BODY_TOO_LARGE", 413, "Nội dung yêu cầu quá dài.");
  if (!request.body) throw new AppError("INVALID_JSON", 400, "Thiếu dữ liệu yêu cầu.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) { await reader.cancel(); throw new AppError("BODY_TOO_LARGE", 413, "Nội dung yêu cầu quá dài."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
export async function readJSON(request: Request, maxBytes = 8192): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new AppError("INVALID_CONTENT_TYPE", 415, "Định dạng yêu cầu không hợp lệ.");
  try { return JSON.parse(new TextDecoder().decode(await readBytes(request,maxBytes))); }
  catch (error) { if(error instanceof AppError)throw error; throw new AppError("INVALID_JSON", 400, "Dữ liệu yêu cầu không đọc được."); }
}

export function privateJSON(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function errorResponse(error: unknown) {
  const requestId = crypto.randomUUID();
  const safe = error instanceof AppError ? error : new AppError("INTERNAL_ERROR", 500, "Có lỗi xảy ra. Vui lòng thử lại sau.");
  if (safe.status >= 500) console.error(JSON.stringify({ request_id: requestId, code: safe.code }));
  return privateJSON({ error: { code: safe.code, message: safe.message, request_id: requestId, ...(safe.fields?{fields:safe.fields}:{}) } }, safe.status);
}
