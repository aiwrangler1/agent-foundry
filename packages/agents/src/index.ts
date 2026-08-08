import type { AgentManifest, CapabilityRegistryEntry, HiringProposal, VersionRef } from "@agent-foundry/domain";
import { executionPreference } from "@agent-foundry/policies";

export class CapabilityRegistry {
  private readonly entries = new Map<string, CapabilityRegistryEntry>();
  register(entry: CapabilityRegistryEntry): CapabilityRegistryEntry { this.entries.set(entry.id, entry); return entry; }
  list(): CapabilityRegistryEntry[] { return [...this.entries.values()]; }
  findQualified(kind: CapabilityRegistryEntry["kind"], businessUnitId: string): CapabilityRegistryEntry[] { return this.list().filter((entry) => entry.kind === kind && entry.qualified && entry.businessUnitIds.includes(businessUnitId)); }
}

export interface WorkforceDecision { step: ReturnType<typeof executionPreference>[number]; outcome: "reuse" | "use" | "propose" | "escalate"; evidence: string; }
export interface WorkforceSeedInput {
  organizationId: string;
  businessUnitId: string;
  createdBy?: string;
  asOf?: string;
  seedNamespace?: string;
}

export interface FilingResearchWorkforceSeed {
  ceoAgent: AgentManifest;
  filingResearchCapability: CapabilityRegistryEntry;
  taxAgent?: AgentManifest;
  taxResearchCapability?: CapabilityRegistryEntry;
}

export interface TaxResearchWorkforceSeed {
  taxAgent: AgentManifest;
  taxResearchCapability: CapabilityRegistryEntry;
}

const DEFAULT_SEED_NAMESPACE = "seed";
const DEFAULT_CREATED_BY = "system:agent-foundry";
const DEFAULT_AS_OF = "2026-08-06T00:00:00.000Z";
const SHADOW_CEO_MODEL_POOL = ["qualified-inexpensive-filing-research", "qualified-stronger-filing-research"] as const;
const SHADOW_TAX_MODEL_POOL = ["qualified-inexpensive-tax-research", "qualified-stronger-tax-research"] as const;
const SHADOW_CEO_READ_ONLY_TOOLS = [
  "tool:authoritative-filing-retrieval.read",
  "tool:government-guidance-search.read",
  "tool:citation-formatter.read",
  "tool:draft-checklist-generator.read"
] as const;
const SHADOW_TAX_READ_ONLY_TOOLS = [
  "tool:irs-guidance-retrieval.read",
  "tool:new-york-tax-guidance-retrieval.read",
  "tool:government-guidance-search.read",
  "tool:citation-formatter.read",
  "tool:tax-checklist-generator.read"
] as const;
const FILING_RESEARCH_METADATA = {
  taskClass: "filing_research",
  authorityMode: "shadow",
  writeAuthority: "none",
  outputMode: "citation-producing research or draft checklist",
  promptDiscipline: "facts assumptions hypotheses unresolved_questions",
  retrievalPolicy: "authoritative sources before model inference",
  toolScope: SHADOW_CEO_READ_ONLY_TOOLS.join(","),
  dataScope: "public,internal,confidential",
  dataAccessMode: "read-only",
  modelQualifications: "citation-producing,high-stakes-research,read-only-tool-use",
  prohibitedActions: "submit_filing,pay_fee,accept_terms,change_permissions,production_write",
  escalationTargets: "human reviewer,qualified legal professional,qualified tax professional"
} as const;
const TAX_RESEARCH_METADATA = {
  taskClass: "tax_research",
  authorityMode: "shadow",
  writeAuthority: "none",
  outputMode: "citation-producing research or draft tax checklist",
  promptDiscipline: "facts assumptions hypotheses unresolved_questions",
  retrievalPolicy: "irs and new york authoritative sources before model inference",
  toolScope: SHADOW_TAX_READ_ONLY_TOOLS.join(","),
  dataScope: "public,internal,confidential",
  dataAccessMode: "read-only",
  modelQualifications: "citation-producing,high-stakes-research,read-only-tool-use",
  prohibitedActions: "register_tax_account,file_return,pay_tax,make_tax_election,change_permissions,production_write",
  escalationTargets: "human reviewer,qualified cpa,qualified tax attorney"
} as const;

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

function createSeedVersionRef(input: WorkforceSeedInput, sha256: string): VersionRef {
  return {
    version: 1,
    createdAt: input.asOf ?? DEFAULT_AS_OF,
    createdBy: input.createdBy ?? DEFAULT_CREATED_BY,
    sha256
  };
}

function createSeedId(
  input: WorkforceSeedInput,
  kind: "agent" | "capability",
  name: "shadow-ceo" | "filing-research" | "shadow-tax-agent" | "tax-research"
): string {
  const namespace = input.seedNamespace ?? DEFAULT_SEED_NAMESPACE;
  return `${kind}:${namespace}:${input.organizationId}:${input.businessUnitId}:${name}`;
}

export function createShadowCeoAgentManifest(input: WorkforceSeedInput): AgentManifest {
  return {
    organizationId: input.organizationId,
    businessUnitId: input.businessUnitId,
    id: createSeedId(input, "agent", "shadow-ceo"),
    name: "Shadow CEO",
    role: "ceo",
    promptVersion: createSeedVersionRef(input, "shadow-ceo-prompt-v1"),
    policyVersion: createSeedVersionRef(input, "shadow-ceo-policy-v1"),
    approvedModels: [...SHADOW_CEO_MODEL_POOL],
    approvedTools: [...SHADOW_CEO_READ_ONLY_TOOLS],
    approvedData: ["public", "internal", "confidential"],
    costCenter: "executive-research",
    authority: "none",
    memoryScope: `task:${input.organizationId}:${input.businessUnitId}:shadow-ceo`,
    status: "shadow"
  };
}

export function createFilingResearchCapabilityManifest(input: WorkforceSeedInput): CapabilityRegistryEntry {
  return {
    organizationId: input.organizationId,
    businessUnitId: input.businessUnitId,
    id: createSeedId(input, "capability", "filing-research"),
    kind: "capability",
    name: "filing-research",
    description: "Read-only filing research for the CEO role using authoritative sources, citation-producing outputs, and mandatory human escalation for legal or tax decisions.",
    version: createSeedVersionRef(input, "filing-research-capability-v1"),
    qualified: true,
    businessUnitIds: [input.businessUnitId],
    metadata: { ...FILING_RESEARCH_METADATA }
  };
}

export function createShadowTaxAgentManifest(input: WorkforceSeedInput): AgentManifest {
  return {
    organizationId: input.organizationId,
    businessUnitId: input.businessUnitId,
    id: createSeedId(input, "agent", "shadow-tax-agent"),
    name: "Shadow Tax Agent",
    role: "tax",
    promptVersion: createSeedVersionRef(input, "shadow-tax-agent-prompt-v1"),
    policyVersion: createSeedVersionRef(input, "shadow-tax-agent-policy-v1"),
    approvedModels: [...SHADOW_TAX_MODEL_POOL],
    approvedTools: [...SHADOW_TAX_READ_ONLY_TOOLS],
    approvedData: ["public", "internal", "confidential"],
    costCenter: "tax-research",
    authority: "none",
    memoryScope: `task:${input.organizationId}:${input.businessUnitId}:shadow-tax-agent`,
    status: "shadow"
  };
}

export function createTaxResearchCapabilityManifest(input: WorkforceSeedInput): CapabilityRegistryEntry {
  return {
    organizationId: input.organizationId,
    businessUnitId: input.businessUnitId,
    id: createSeedId(input, "capability", "tax-research"),
    kind: "capability",
    name: "tax-research",
    description: "Read-only tax research using IRS and New York authoritative sources, citation-producing outputs, and mandatory human escalation for registration, filing, payment, or election decisions.",
    version: createSeedVersionRef(input, "tax-research-capability-v1"),
    qualified: true,
    businessUnitIds: [input.businessUnitId],
    metadata: { ...TAX_RESEARCH_METADATA }
  };
}

export function seedShadowCeoFilingResearchWorkforce(input: WorkforceSeedInput): FilingResearchWorkforceSeed {
  return {
    ceoAgent: createShadowCeoAgentManifest(input),
    filingResearchCapability: createFilingResearchCapabilityManifest(input)
  };
}

export function seedShadowTaxResearchWorkforce(input: WorkforceSeedInput): TaxResearchWorkforceSeed {
  return {
    taxAgent: createShadowTaxAgentManifest(input),
    taxResearchCapability: createTaxResearchCapabilityManifest(input)
  };
}
