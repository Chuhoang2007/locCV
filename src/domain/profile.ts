import { z } from "zod";

export const modeSchema = z.enum(["HR", "CANDIDATE"]);
export type Mode = z.infer<typeof modeSchema>;
export const timezoneSchema = z.string().max(100).refine(value => {
  try { new Intl.DateTimeFormat("vi", { timeZone: value }); return true; }
  catch { return false; }
}, "Múi giờ không hợp lệ.");

export const profileUpdateSchema = z.strictObject({
  display_name: z.string().trim().min(1, "Vui lòng nhập tên hiển thị.").max(120, "Tên tối đa 120 ký tự.").optional(),
  preferred_mode: modeSchema.optional(),
  timezone: timezoneSchema.optional(),
}).refine(value => Object.keys(value).length > 0, "Chưa có thông tin cần cập nhật.");

export const profileSchema = z.object({
  id: z.uuid(), display_name: z.string(), preferred_mode: modeSchema,
  timezone: z.string(), created_at: z.string(), updated_at: z.string(),
});

export type Profile = z.infer<typeof profileSchema>;
export const modeHome = (mode: Mode) => mode === "HR" ? "/hr" : "/candidate/applications";
