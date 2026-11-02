import "server-only";
import { createHash } from "node:crypto";
import { AppError } from "@/lib/errors";

export function idempotencyKey(request: Request) {
  const key = request.headers.get("idempotency-key");
  if (!key || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw new AppError("INVALID_IDEMPOTENCY_KEY",400,"Vui lòng tải lại trang rồi thực hiện lại thao tác.");
  return key;
}
export function requestHash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
