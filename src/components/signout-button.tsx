"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, LoaderCircle } from "lucide-react";
import { clientJSON } from "@/lib/client-api";
import { Button } from "./ui/button";

export function SignoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function signout() {
    setPending(true); setError("");
    try {
      await clientJSON("/api/auth/logout", "POST");
      window.dispatchEvent(new Event("loccv-signout"));
      try { const channel=new BroadcastChannel("loccv-auth");channel.postMessage("SIGNED_OUT");channel.close(); } catch { /* Local cleanup still works when cross-tab messaging is unavailable. */ }
      try {
        for (const key of Object.keys(localStorage)) if (key.startsWith("loccv-answers:")) localStorage.removeItem(key);
      } catch { /* Không chặn đăng xuất khi trình duyệt khóa localStorage. */ }
      router.replace("/login"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Chưa thể đăng xuất."); setPending(false); }
  }
  return <div><Button type="button" variant="ghost" size="small" onClick={signout} disabled={pending}>{pending ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <LogOut size={16} aria-hidden="true" />}Đăng xuất</Button>{error && <p className="field-error" role="alert">{error}</p>}</div>;
}
