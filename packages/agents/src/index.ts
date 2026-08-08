import type { AgentManifest, CapabilityRegistryEntry, HiringProposal } from "@agent-foundry/domain";
import { executionPreference } from "@agent-foundry/policies";

export class CapabilityRegistry {
  private readonly entries = new Map<string, CapabilityRegistryEntry>();
  register(entry: CapabilityRegistryEntry): CapabilityRegistryEntry { this.entries.set(entry.id, entry); return entry; }
  list(): CapabilityRegistryEntry[] { return [...this.entries.values()]; }
  findQualified(kind: CapabilityRegistryEntry["kind"], businessUnitId: string): CapabilityRegistryEntry[] { return this.list().filter((entry) => entry.kind === kind && entry.qualified && entry.businessUnitIds.includes(businessUnitId)); }
}

export interface WorkforceDecision { step: ReturnType<typeof executionPreference>[number]; outcome: "reuse" | "use" | "propose" | "escalate"; evidence: string; }

export function evaluateWorkforceNeed(input: { artifactAvailable: boolean; authoritativeDataAvailable: boolean; deterministicRuleAvailable: boolean; existingToolAvailable: boolean; existingWorkflowExtendable: boolean; existingAgentAvailable: boolean; externalServiceAvailable: boolean; ephemeralFit: boolean; persistentFit: boolean }): WorkforceDecision[] {
  const checks: Array<[WorkforceDecision["step"], boolean, WorkforceDecision["outcome"], string]> = [
    ["cache", input.artifactAvailable, "reuse", "reuse existing result or artifact"],
    ["authoritative_retrieval", input.authoritativeDataAvailable, "reuse", "retrieve authoritative stored information"],
    ["deterministic_rule", input.deterministicRuleAvailable, "use", "apply deterministic rule"],
    ["script_or_query", input.existingToolAvailable, "use", "use existing script, tool, or workflow"],
    ["deterministic_workflow", input.existingWorkflowExtendable, "use", "extend an existing workflow"],
    ["api_or_tool", input.existingAgentAvailable, "use", "use an existing agent"],
    ["api_or_tool", input.externalServiceAvailable, "use", "use an external API or service"],
    ["qualified_inexpensive_model", input.ephemeralFit, "propose", "create an ephemeral agent"],
    ["qualified_stronger_model", input.persistentFit, "propose", "create a persistent agent or team"],
    ["human_escalation", true, "escalate", "escalate to a human"]
  ];
  const decisions: WorkforceDecision[] = [];
  for (const [step, available, outcome, evidence] of checks) { decisions.push({ step, outcome: available ? outcome : "escalate", evidence: available ? evidence : `insufficient at ${step}` }); if (available) break; }
  return decisions;
}

export function createCandidate(proposal: HiringProposal, proposer: AgentManifest): AgentManifest {
  if (proposal.proposerAgentId !== proposer.id) throw new Error("proposer_identity_mismatch");
  return {
    organizationId: proposal.organizationId,
    ...(proposal.businessUnitId ? { businessUnitId: proposal.businessUnitId } : {}),
    id: `candidate:${proposal.id}`,
    name: proposal.roleSpecification,
    role: proposal.roleSpecification,
    promptVersion: { version: 1, createdAt: new Date().toISOString(), createdBy: proposer.id, sha256: "candidate-prompt" },
    policyVersion: { version: 1, createdAt: new Date().toISOString(), createdBy: proposer.id, sha256: "candidate-policy" },
    approvedModels: proposal.modelQualifications,
    approvedTools: [],
    approvedData: [],
    costCenter: "unassigned-pending-finance-review",
    authority: "none",
    memoryScope: `proposal:${proposal.id}`,
    status: "candidate"
  };
}
