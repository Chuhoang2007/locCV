import type { NextConfig } from "next";

// Fail before compiling a client bundle if a server secret was put in a public variable.
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (publicKey?.startsWith("sb_secret_")) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must contain a public key.");
if (publicKey?.startsWith("eyJ")) {
  let role: unknown;
  try { role = JSON.parse(Buffer.from(publicKey.split(".")[1], "base64url").toString()).role; } catch { /* Invalid key is rejected below. */ }
  if (role !== "anon") throw new Error("The public Supabase JWT must use the anon role.");
}

const config: NextConfig = {
  ...(process.env.NEXT_OUTPUT==="standalone"?{output:"standalone" as const}:{}),
  poweredByHeader: false,
  devIndicators: false,
  logging: { incomingRequests: false, fetches: { fullUrl: false } },
  outputFileTracingIncludes:{"/api/cv/extract":["./worker/parser-process.mjs","./node_modules/pdfjs-dist/**","./node_modules/yauzl/**","./node_modules/pend/**","./node_modules/saxes/**","./node_modules/xmlchars/**","./node_modules/@napi-rs/**"]},
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};
export default config;
