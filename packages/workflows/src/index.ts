export interface DurableWorkflowPort { start(objectiveId: string): Promise<{ runId: string }>; pause(runId: string, reason: string): Promise<void>; resume(runId: string, decision: string): Promise<void>; }
export interface AutomationCompilerProposal { sourceWorkflow: string; repeatedPath: string[]; deterministicReplacement: string; testPlan: string[]; policyReviewRequired: true; shadowComparisonRequired: true; status: "proposed" | "shadow" | "approved" | "rejected"; }

export function proposeAutomation(path: string[]): AutomationCompilerProposal {
  return { sourceWorkflow: "unknown", repeatedPath: path, deterministicReplacement: "pending implementation", testPlan: ["unit", "integration", "policy", "shadow comparison"], policyReviewRequired: true, shadowComparisonRequired: true, status: "proposed" };
}
