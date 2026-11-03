"use client";
import { usePathname } from "next/navigation";
import { useFeedbackRouter as useRouter } from "@/hooks/use-feedback-router";
import { useState } from "react";
import { BriefcaseBusiness, UserRound, LoaderCircle } from "lucide-react";
import { modeHome, type Mode } from "@/domain/profile";
import { clientJSON } from "@/lib/client-api";
import { useRoutePending } from "./navigation-feedback";

export function ModeSwitch({ mode }: { mode: Mode }) {
  const router = useRouter();
  const pathname = usePathname();
  const routePending=useRoutePending();
  const [pending, setPending] = useState<Mode | null>(null);
  const [error, setError] = useState("");
  async function change(next: Mode) {
    if (mode === next || pending) return;
    setPending(next); setError("");
    try {
      await clientJSON("/api/me", "PATCH", { preferred_mode: next });
      if (pathname !== "/settings") router.push(modeHome(next));
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Chưa chuyển được chế độ."); }
    finally { setPending(null); }
  }
  return <div className="mode-switch-wrap"><div className="mode-switch" role="group" aria-label="Chế độ sử dụng" aria-busy={Boolean(pending)||routePending}>
    <button type="button" aria-pressed={mode === "CANDIDATE"} disabled={Boolean(pending)||routePending} onClick={() => change("CANDIDATE")}>{pending === "CANDIDATE" ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : <UserRound size={15} aria-hidden="true" />}Ứng viên</button>
    <button type="button" aria-pressed={mode === "HR"} disabled={Boolean(pending)||routePending} onClick={() => change("HR")}>{pending === "HR" ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : <BriefcaseBusiness size={15} aria-hidden="true" />}Tuyển dụng</button>
  </div>{error && <p role="alert" className="field-error">{error}</p>}</div>;
}
