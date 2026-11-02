"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, LoaderCircle } from "lucide-react";
import type { Profile } from "@/domain/profile";
import { timezoneSchema } from "@/domain/profile";
import { clientJSON, ClientAPIError } from "@/lib/client-api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const schema = z.strictObject({ display_name: z.string().trim().min(1,"Vui lòng nhập tên hiển thị.").max(120,"Tên tối đa 120 ký tự."), timezone: timezoneSchema });
export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { display_name: profile.display_name, timezone: profile.timezone } });
  const zones = [...new Set([profile.timezone,"Asia/Bangkok","Asia/Ho_Chi_Minh","Asia/Tokyo","Europe/London","America/New_York","UTC"])];
  return <form onSubmit={handleSubmit(async values => {
    setMessage(""); setError("");
    try {
      await clientJSON("/api/me","PATCH",values);
      reset(values); setMessage("Đã lưu thay đổi."); router.refresh();
    } catch (e) {
      if (e instanceof ClientAPIError && e.status === 401) { router.replace("/login"); router.refresh(); return; }
      setError(e instanceof Error ? e.message : "Chưa thể lưu thay đổi.");
    }
  })} noValidate className="profile-form">
    <div className="profile-fields"><div className="field"><label htmlFor="display_name">Tên hiển thị</label><Input id="display_name" maxLength={120} autoComplete="name" {...register("display_name")} aria-invalid={Boolean(errors.display_name)} aria-describedby={errors.display_name ? "profile-name-error" : "profile-name-hint"} />{errors.display_name ? <p id="profile-name-error" className="field-error">{errors.display_name.message}</p> : <p id="profile-name-hint" className="field-hint">Tên này xuất hiện trong cả hai chế độ.</p>}</div><div className="field"><label htmlFor="timezone">Múi giờ</label><select id="timezone" className="input" {...register("timezone")} aria-invalid={Boolean(errors.timezone)} aria-describedby="timezone-hint">{zones.map(zone => <option key={zone} value={zone}>{({"Asia/Bangkok":"Bangkok (GMT+7)","Asia/Ho_Chi_Minh":"Việt Nam (GMT+7)","Asia/Tokyo":"Tokyo (GMT+9)","UTC":"UTC"} as Record<string,string>)[zone] ?? zone}</option>)}</select><p id="timezone-hint" className="field-hint">Dùng để hiển thị thời gian trong tài khoản.</p>{errors.timezone && <p className="field-error">{errors.timezone.message}</p>}</div></div>
    <div className="form-actions"><div aria-live="polite">{message && <span className="saved-message"><Check size={16} aria-hidden="true" />{message}</span>}{error && <p className="field-error" role="alert">{error}</p>}</div><Button type="submit" disabled={isSubmitting || !isDirty}>{isSubmitting && <LoaderCircle size={16} className="spin" aria-hidden="true" />}Lưu thay đổi</Button></div>
  </form>;
}
