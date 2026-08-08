import type { ActionClass, AgentManifest, AuthorityLevel, ExecutionStep, ToolDefinition } from "@agent-foundry/domain";
import { z } from "zod";

export const policyVersionSchema = z.object({ version: z.number().int().positive(), sha256: z.string().min(8) });
export const externalContentSchema = z.object({ source: z.string(), content: z.string(), provenance: z.string() });

const authorityRank: Record<AuthorityLevel, number> = { none: 0, sandbox: 1, shadow: 1, scoped_write: 2, human_only: 99 };
const actionRank: Record<ActionClass, number> = { CLASS_0_READ_ONLY: 0, CLASS_1_REVERSIBLE_AUTONOMOUS_WRITE: 1, CLASS_2_APPROVAL_REQUIRED: 2, CLASS_3_HUMAN_ONLY: 3, CLASS_4_PROHIBITED: 4 };

export function executionPreference(): readonly ExecutionStep[] {
  return ["cache", "authoritative_retrieval", "deterministic_rule", "script_or_query", "api_or_tool", "deterministic_workflow", "qualified_inexpensive_model", "qualified_stronger_model", "human_escalation"];
}

export function canInvokeTool(agent: AgentManifest, tool: ToolDefinition, productionWritesEnabled: boolean): { allowed: boolean; reason: string } {
  if (!tool.enabled) return { allowed: false, reason: "tool_disabled" };
  if (tool.actionClass === "CLASS_4_PROHIBITED") return { allowed: false, reason: "prohibited_action" };
  if (!productionWritesEnabled && tool.actionClass !== "CLASS_0_READ_ONLY") return { allowed: false, reason: "production_writes_disabled" };
  if (!agent.approvedTools.includes(tool.id)) return { allowed: false, reason: "tool_not_approved_for_agent" };
  if (authorityRank[agent.authority] < authorityRank[tool.requiredAuthority]) return { allowed: false, reason: "insufficient_authority" };
  return { allowed: true, reason: "policy_allows" };
}

export function canApprove(requestingAgentId: string, approvingActorId: string, approvingRole: "CEO" | "CFO" | "reviewer" | "auditor"): boolean {
  if (requestingAgentId === approvingActorId) return false;
  return approvingRole !== "auditor";
}

export function classifyUntrustedContent(input: unknown): { trustedForPolicy: false; content: string } {
  const parsed = externalContentSchema.safeParse(input);
  return { trustedForPolicy: false, content: parsed.success ? parsed.data.content : "" };
}

export function exceedsActionClass(declared: ActionClass, requested: ActionClass): boolean {
  return actionRank[requested] > actionRank[declared];
}

export function isImmutablePolicyVersion(current: number, proposed: number): boolean { return proposed > current; }
