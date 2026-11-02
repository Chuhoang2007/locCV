import "server-only";
import { z } from "zod";
import { AppError, configurationError } from "./errors.ts";

const publicConfig = z.object({
  url: z.url().refine(value => {
    const url = new URL(value);
    return !url.username && !url.password && !url.search && !url.hash &&
      (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
  }),
  key: z.string().trim().min(1).refine(key => !key.startsWith("sb_secret_")),
});

export function getPublicEnv() {
  const parsed = publicConfig.safeParse({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY });
  if (!parsed.success) throw configurationError();
  // Không chấp nhận legacy service_role JWT vô tình đặt vào biến public.
  if (parsed.data.key.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(Buffer.from(parsed.data.key.split(".")[1], "base64url").toString());
      if (payload.role !== "anon") throw configurationError();
    } catch { throw configurationError(); }
  }
  return parsed.data;
}

export function hasPublicEnv() { try { getPublicEnv(); return true; } catch { return false; } }
export function isAccountConfigured() { return hasPublicEnv() && Boolean(process.env.SUPABASE_SECRET_KEY?.trim()); }
export function getServerEnv() {
  const config = getPublicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secret) throw configurationError();
  return { ...config, secret };
}
export function getSiteOrigin() {
  const parsed = z.url().safeParse(process.env.SITE_URL ?? "http://127.0.0.1:3000");
  if (!parsed.success) throw configurationError();
  const url = new URL(parsed.data);
  if (url.username || url.password || !["https:", "http:"].includes(url.protocol)) throw configurationError();
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(url.hostname)) throw configurationError();
  return url.origin;
}

export function getAISettings() {
  const base = process.env.NINE_ROUTER_BASE_URL?.trim();
  const key = process.env.NINE_ROUTER_API_KEY?.trim();
  const model = process.env.NINE_ROUTER_MODEL?.trim();
  if (!base || !key || !model) throw new AppError("AI_NOT_CONFIGURED",503,"Dịch vụ AI chưa sẵn sàng. Bạn vẫn có thể soạn tin thủ công.");
  try { const url = new URL(base); if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error(); }
  catch { throw configurationError(); }
  return { model };
}
