import { z } from "zod";
import { AIClientError,evaluateCandidateCV } from "../../src/lib/ai-client.js";
import { ScoringRubricSchema } from "../../src/lib/ai-schemas.js";
import type { GenerationTask,QueueStore } from "../queue.js";
export async function evaluateCVTask(store:QueueStore,task:GenerationTask,options:Parameters<typeof evaluateCandidateCV>[2],evaluate= evaluateCandidateCV){
  if(!task.application_id||task.input_version!==1)throw new AIClientError("INVALID_INPUT");
  const app=await store.getCV(task.application_id);
  if(app.status!=="CV_SUBMITTED"||app.cv_score!==null)throw new AIClientError("INVALID_INPUT");
  const snapshot=z.object({scoring_rubric:ScoringRubricSchema}).parse(app.job_snapshot_json);
  return evaluate(app.cv_text,snapshot.scoring_rubric,options);
}
