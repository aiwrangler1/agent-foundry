import type { CostRecord, DataClassification, UUID } from "@agent-foundry/domain";

export interface ProviderHealth { provider: string; healthy: boolean; checkedAt: string; detail?: string; }
export interface SemrushPort { keywordResearch(query: string): Promise<{ apiUnits: number; rows: Array<Record<string, string>> }>; competitorResearch(domain: string): Promise<{ apiUnits: number; rows: Array<Record<string, string>> }>; }
export interface GitHubPort { createIssue(title: string, body: string): Promise<{ id: string; url: string }>; }
export interface NotificationPort { notifyHuman(subject: string, body: string): Promise<{ deliveryId: string }>; }

export type HarnessName = "codex" | "opencode" | "ai-sdk-harness-agent";
export interface HarnessToolRef { id: string; actionClass: "CLASS_0_READ_ONLY"; }
export interface HarnessTask { taskId: UUID; prompt: string; context: string; readOnlyTools: HarnessToolRef[]; }
export interface GatewayActionProposal { toolId: string; action: string; arguments: Record<string, unknown>; requiresGatewayAuthorization: true; }
export interface HarnessResult { output: string; proposedGatewayActions: GatewayActionProposal[]; model: string; costMinor: number; cost?: CostRecord; }
export interface HarnessAgent { name: HarnessName; experimental: true; nativeToolFiltering: boolean; nativeApprovalRequests: boolean; invoke(task: HarnessTask): Promise<HarnessResult>; }

export function assertHarnessTaskSafe(task: HarnessTask): true {
  if (task.readOnlyTools.some((tool) => tool.actionClass !== "CLASS_0_READ_ONLY")) throw new Error("harness_task_contains_non_read_only_tool");
  return true;
}

export interface ModelRouter { select(input: { taskClass: string; requiredQualifications: string[]; maxCostMinor: number }): Promise<{ model: string; qualified: true; estimatedCostMinor: number }>; }
export interface CredentialProvider { resolve(reference: { integrationId: UUID; purpose: string; dataClassification: DataClassification }): Promise<{ opaqueHandle: string; expiresAt: string }>; }

export type FilingResearchToolId = "filing-research.sec-submissions" | "filing-research.sec-companyfacts" | "filing-research.sec-edgar-document";
export interface FilingResearchRequest { organizationId: UUID; businessUnitId?: UUID; requestedByAgentId: UUID; question: string; companyName?: string; cik?: string; formTypes?: string[]; }
export interface AuthoritativeFilingSource { id: UUID; title: string; url: string; publisher: string; documentType: string; retrievedAt: string; snippet: string; facts: string[]; confidence: number; }
export interface AuthoritativeFilingSourceRetriever { retrieve(input: FilingResearchRequest): Promise<AuthoritativeFilingSource[]>; }

export type TaxResearchToolId = "tax-research.irs-guidance" | "tax-research.state-tax-guidance" | "tax-research.local-tax-guidance";
export interface TaxResearchRequest {
  organizationId: UUID;
  businessUnitId?: UUID;
  requestedByAgentId: UUID;
  question: string;
  jurisdictions: string[];
  entityType?: string;
  businessActivities?: string[];
  knownFilingFacts?: string[];
}
export interface AuthoritativeTaxSource {
  id: UUID;
  title: string;
  url: string;
  publisher: string;
  jurisdiction: string;
  sourceType: string;
  retrievedAt: string;
  snippet: string;
  facts: string[];
  confidence: number;
}
export interface AuthoritativeTaxSourceRetriever { retrieve(input: TaxResearchRequest): Promise<AuthoritativeTaxSource[]>; }

const untrustedInstructionPattern = /(?:ignore|disregard|override|follow)\s+(?:all\s+)?(?:previous|prior|system|developer|tool)\s+instructions?/i;

export function assertFilingEvidenceUntrusted(source: Pick<AuthoritativeFilingSource, "snippet" | "facts">): true {
  const evidence = [source.snippet, ...source.facts].join("\n");
  if (untrustedInstructionPattern.test(evidence)) throw new Error("untrusted_filing_content_contains_instruction");
  return true;
}

export function assertTaxEvidenceUntrusted(source: Pick<AuthoritativeTaxSource, "snippet" | "facts">): true {
  const evidence = [source.snippet, ...source.facts].join("\n");
  if (untrustedInstructionPattern.test(evidence)) throw new Error("untrusted_tax_content_contains_instruction");
  return true;
}

export const filingResearchReadOnlyTools: readonly HarnessToolRef[] = [
  { id: "filing-research.sec-submissions", actionClass: "CLASS_0_READ_ONLY" },
  { id: "filing-research.sec-companyfacts", actionClass: "CLASS_0_READ_ONLY" },
  { id: "filing-research.sec-edgar-document", actionClass: "CLASS_0_READ_ONLY" }
];

export const taxResearchReadOnlyTools: readonly HarnessToolRef[] = [
  { id: "tax-research.irs-guidance", actionClass: "CLASS_0_READ_ONLY" },
  { id: "tax-research.state-tax-guidance", actionClass: "CLASS_0_READ_ONLY" },
  { id: "tax-research.local-tax-guidance", actionClass: "CLASS_0_READ_ONLY" }
];

const forbiddenFilingWriteToolPattern = /(filing-submit|filing-submission|submit|payment|pay|permission|authorize|grant|sign)/i;
const forbiddenFilingWriteActionPattern = /(submit|submission|payment|pay|permission|authorize|grant|sign)/i;

export function assertFilingResearchToolsReadOnly(tools: readonly HarnessToolRef[]): true {
  if (tools.length === 0) throw new Error("filing_research_requires_read_only_tools");
  for (const tool of tools) {
    if (tool.actionClass !== "CLASS_0_READ_ONLY") throw new Error("filing_research_tool_must_be_read_only");
    if (forbiddenFilingWriteToolPattern.test(tool.id)) throw new Error("filing_research_tool_registers_forbidden_write_capability");
  }
  return true;
}

export function assertNoFilingWriteCapability(input: { tools?: readonly HarnessToolRef[]; proposedGatewayActions?: readonly GatewayActionProposal[] }): true {
  if (input.tools) assertFilingResearchToolsReadOnly(input.tools);
  for (const proposal of input.proposedGatewayActions ?? []) {
    if (forbiddenFilingWriteToolPattern.test(proposal.toolId) || forbiddenFilingWriteActionPattern.test(proposal.action)) throw new Error("filing_write_action_proposed_in_read_only_path");
  }
  return true;
}

const allowedTaxResearchToolIds = new Set<string>(taxResearchReadOnlyTools.map((tool) => tool.id));
const forbiddenTaxWriteToolPattern = /(register|registration|filing|file-return|return-filing|submit|payment|pay|remit|collect-tax|charge-tax|election|elect|form-2553|form-8832|certificate|create|update|delete|write|post|put|patch|account|authorize|grant|sign)/i;
const forbiddenTaxWriteActionPattern = /(register|registration|file|filing|submit|payment|pay|remit|collect|charge|election|elect|create|update|delete|write|post|put|patch|authorize|grant|sign)/i;

export function assertTaxResearchToolsReadOnly(tools: readonly HarnessToolRef[]): true {
  if (tools.length === 0) throw new Error("tax_research_requires_read_only_tools");
  for (const tool of tools) {
    if (tool.actionClass !== "CLASS_0_READ_ONLY") throw new Error("tax_research_tool_must_be_read_only");
    if (!allowedTaxResearchToolIds.has(tool.id)) throw new Error("tax_research_tool_not_approved");
    if (forbiddenTaxWriteToolPattern.test(tool.id)) throw new Error("tax_research_tool_registers_forbidden_write_capability");
  }
  return true;
}

export function assertNoTaxWriteCapability(input: { tools?: readonly HarnessToolRef[]; proposedGatewayActions?: readonly GatewayActionProposal[] }): true {
  if (input.tools) assertTaxResearchToolsReadOnly(input.tools);
  for (const proposal of input.proposedGatewayActions ?? []) {
    if (forbiddenTaxWriteToolPattern.test(proposal.toolId) || forbiddenTaxWriteActionPattern.test(proposal.action)) throw new Error("tax_write_action_proposed_in_read_only_path");
  }
  return true;
}

export const mockedSemrush: SemrushPort = {
  async keywordResearch(query) { return { apiUnits: 1, rows: [{ query, volume: "mocked", competition: "mocked" }] }; },
  async competitorResearch(domain) { return { apiUnits: 1, rows: [{ domain, competitors: "mocked" }] }; }
};
