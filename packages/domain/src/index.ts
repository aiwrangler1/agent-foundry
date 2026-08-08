export type UUID = string;
export type ISODateTime = string;
export type DataClassification = "public" | "internal" | "confidential" | "restricted";
export type AuthorityLevel = "none" | "sandbox" | "shadow" | "scoped_write" | "human_only";
export type AgentStatus = "candidate" | "shadow" | "active" | "suspended" | "retired";
export type ActionClass = "CLASS_0_READ_ONLY" | "CLASS_1_REVERSIBLE_AUTONOMOUS_WRITE" | "CLASS_2_APPROVAL_REQUIRED" | "CLASS_3_HUMAN_ONLY" | "CLASS_4_PROHIBITED";
export type CostClass = "none" | "low" | "variable" | "commitment";
export type ExecutionStep = "cache" | "authoritative_retrieval" | "deterministic_rule" | "script_or_query" | "api_or_tool" | "deterministic_workflow" | "qualified_inexpensive_model" | "qualified_stronger_model" | "human_escalation";

export interface Scope { organizationId: UUID; businessUnitId?: UUID; }
export interface VersionRef { version: number; createdAt: ISODateTime; createdBy: UUID; sha256: string; }
export interface AgentManifest extends Scope {
  id: UUID; name: string; role: string; parentAgentId?: UUID; teamId?: UUID;
  promptVersion: VersionRef; policyVersion: VersionRef; approvedModels: string[];
  approvedTools: string[]; approvedData: DataClassification[]; costCenter: string;
  authority: AuthorityLevel; memoryScope: string; status: AgentStatus;
}
export interface TeamManifest extends Scope { id: UUID; name: string; objective?: string; memberAgentIds: UUID[]; templateId?: UUID; status: "temporary" | "persistent" | "retired"; }
export interface CapabilityRegistryEntry extends Scope { id: UUID; kind: "capability" | "tool" | "script" | "workflow" | "service" | "role" | "model" | "evaluation"; name: string; description: string; version: VersionRef; qualified: boolean; businessUnitIds: UUID[]; metadata: Record<string, string>; }
export interface HiringProposal extends Scope { id: UUID; proposerAgentId: UUID; capabilityGap: string; insufficiency: string; expectedOutcome: string; expectedOperatingCost: string; roleSpecification: string; requiredTools: string[]; requiredData: DataClassification[]; requestedAuthority: AuthorityLevel; modelQualifications: string[]; evaluationSuite: string[]; escalationBehavior: string; promotionConditions: string[]; mergeConditions: string[]; retirementConditions: string[]; status: "proposed" | "under_review" | "approved" | "rejected"; }
export interface Objective extends Scope { id: UUID; title: string; requestedBy: UUID; status: "queued" | "planning" | "running" | "blocked" | "awaiting_approval" | "completed" | "failed"; }
export interface ToolDefinition extends Scope { id: UUID; name: string; actionClass: ActionClass; requiredAuthority: AuthorityLevel; dataClassification: DataClassification; reversible: boolean; costClass: CostClass; createsCommitment: boolean; approvalPolicy: string; idempotencyRequired: boolean; enabled: boolean; }
export interface ToolCall extends Scope { id: UUID; toolId: UUID; agentId: UUID; workflowId: UUID; idempotencyKey: string; actionClass: ActionClass; status: "accepted" | "rejected" | "completed" | "failed"; cost: CostRecord; }
export interface CostRecord { modelInput: number; modelOutput: number; cachedInput: number; apiUnits: number; toolExecution: number; retries: number; failedWork: number; reviewerWork: number; managementCalls: number; storage: number; humanAttention: number; currency: string; }
export interface SpendReservation extends Scope { id: UUID; budgetId: UUID; workflowId: UUID; amountMinor: number; currency: string; status: "reserved" | "committed" | "settled" | "released"; }
export interface SpendAuthorization extends Scope { id: UUID; reservationId: UUID; toolId: UUID; agentId: UUID; workflowId: UUID; costCenter: string; maxAmountMinor: number; idempotencyKey: string; expiresAt: ISODateTime; }
export type MemoryKind = "authoritative_fact" | "decision" | "procedure" | "hypothesis" | "observation" | "temporary_task_context";
export interface MemoryRecord extends Scope { id: UUID; kind: MemoryKind; content: string; provenance: string; confidence: number; authorId: UUID; reviewAt?: ISODateTime; expiresAt?: ISODateTime; }
export type CacheKind = "provider_prompt" | "exact_result" | "semantic_result" | "tool_result" | "retrieval" | "artifact" | "compiled_prompt";
export interface CacheEntry extends Scope { id: UUID; kind: CacheKind; dataClassification: DataClassification; source: string; provenance: string; createdAt: ISODateTime; invalidationPolicy: string; promptVersion?: number; agentVersion?: number; policyVersion?: number; model?: string; costAvoidedMinor: number; hits: number; misses: number; }
export interface ApprovalRequest extends Scope { id: UUID; requestingAgentId: UUID; workflowId: UUID; action: string; reasoning: string; evidence: string[]; costMinor: number; risk: string; status: "pending" | "approved" | "rejected" | "changes_requested"; }
export interface AuditEvent extends Scope { id: UUID; actorId: UUID; eventType: string; objectType: string; objectId: UUID; payload: Record<string, unknown>; occurredAt: ISODateTime; }
