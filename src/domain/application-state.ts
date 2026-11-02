export const APPLICATION_STATUSES = [
  "CV_SUBMITTED", "CV_PASSED", "CV_FAILED", "INTERVIEW_IN_PROGRESS", "EVALUATED", "HR_APPROVED", "HR_REJECTED",
] as const;
export type ApplicationStatus = typeof APPLICATION_STATUSES[number];

const transitions: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  CV_SUBMITTED: ["CV_PASSED", "CV_FAILED"],
  CV_PASSED: ["INTERVIEW_IN_PROGRESS"],
  CV_FAILED: ["INTERVIEW_IN_PROGRESS", "HR_REJECTED"],
  INTERVIEW_IN_PROGRESS: ["EVALUATED"],
  EVALUATED: ["HR_APPROVED", "HR_REJECTED"],
  HR_APPROVED: [], HR_REJECTED: [],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus, policy: "CV_THRESHOLD" | "ALWAYS" = "CV_THRESHOLD") {
  if (from === "CV_FAILED" && to === "INTERVIEW_IN_PROGRESS" && policy !== "ALWAYS") return false;
  return transitions[from].includes(to);
}
export function canApply(ownerId: string, candidateId: string) { return ownerId !== candidateId; }
