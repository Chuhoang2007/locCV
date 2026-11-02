import "server-only";
import { GeneratedJobSchema } from "@/lib/ai-schemas";
import { accessPolicySchema } from "./jobs";
export const publishableDraftSchema = GeneratedJobSchema.extend({ interview_access_policy: accessPolicySchema });
