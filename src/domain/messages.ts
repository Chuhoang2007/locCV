import { z } from "zod";
export const decisionSchema=z.strictObject({expected_version:z.number().int().positive(),decision:z.enum(["APPROVE","REJECT"]),message:z.string().trim().min(1).max(2000)});
export const messageCardSchema=z.object({id:z.uuid(),application_id:z.uuid(),subject:z.string(),kind:z.string(),read_at:z.string().nullable(),created_at:z.string(),audience:z.enum(["HR","CANDIDATE"]),job_title:z.string()});
export const messageDetailSchema=messageCardSchema.extend({body:z.string(),status:z.string(),cv_score:z.number().nullable(),interview_score:z.number().nullable()});
export type MessageCard=z.infer<typeof messageCardSchema>;
export type MessageDetail=z.infer<typeof messageDetailSchema>;
export type InboxPage={items:MessageCard[];next_cursor:string|null;unread_count:number};
export const deletionStatusSchema=z.object({requested_at:z.string().nullable(),scheduled_at:z.string().nullable()});
export type DeletionStatus=z.infer<typeof deletionStatusSchema>;
