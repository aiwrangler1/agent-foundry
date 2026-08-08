export type UUID = string;
export type ISODateTime = string;

export interface LegalEntityProfile {
  legalName: string;
  jurisdiction: string;
  structure: string;
  status: "planned" | "active" | "dissolved";
  publicDisclosure: string;
  brandPolicy: string;
}

/**
 * The legal container is deliberately separate from product, shop, and
 * repository names. Formation and tax status remain subject to human review.
 */
export const ARTJ_LLC_PROFILE: LegalEntityProfile = {
  legalName: "ARTJ LLC",
  jurisdiction: "New York",
  structure: "single-member LLC",
  status: "planned",
  publicDisclosure: "© 2026 ARTJ LLC. This website/shop is owned and operated by ARTJ LLC.",
  brandPolicy: "Use ARTJ LLC for banking, EIN, taxes, contracts, and payment processors; use separate product or shop names publicly without treating every product as a separate DBA."
};

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

/**
 * The PM surface is a projection of these operational states. It must not
 * invent a second task lifecycle: workflow adapters publish these transitions
 * and the control panel records human-originated transitions as audit events.
 */
export const PM_TASK_STATES = [
  "backlog",
  "ready",
  "in_progress",
  "waiting_on_agent",
  "waiting_on_human",
  "review",
  "blocked",
  "complete",
  "cancelled"
] as const;
export type PmTaskState = typeof PM_TASK_STATES[number];
export type PmPriority = "urgent" | "high" | "medium" | "low";
export type PmObjectType = "objective" | "task" | "workflow" | "approval" | "human_request" | "business_unit" | "agent" | "budget" | "incident" | "decision";
export type PmEventType =
  | "objective.created"
  | "task.created"
  | "task.started"
  | "task.blocked"
  | "task.completed"
  | "task.status_changed"
  | "task.priority_changed"
  | "task.note_added"
  | "agent.assigned"
  | "agent.finished"
  | "workflow.started"
  | "workflow.paused"
  | "workflow.resumed"
  | "workflow.failed"
  | "approval.requested"
  | "approval.approved"
  | "approval.rejected"
  | "approval.changes_requested"
  | "human_request.created"
  | "human_request.completed"
  | "budget.reserved"
  | "spend.authorized"
  | "spend.settled"
  | "artifact.created"
  | "decision.recorded"
  | "incident.created"
  | "business.paused";

export interface PmTask extends Scope {
  id: UUID;
  objectiveId: UUID;
  title: string;
  state: PmTaskState;
  priority: PmPriority;
  requestedBy: UUID;
  assignedAgentId?: UUID;
  reviewerId?: UUID;
  businessUnitId?: UUID;
  workflowId?: UUID;
  costCenter?: string;
  dueAt?: ISODateTime;
  blockedReason?: string | undefined;
  progressPercent: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PmEvent extends Scope {
  id: UUID;
  type: PmEventType;
  actorId: UUID;
  objectType: PmObjectType;
  objectId: UUID;
  payload: Record<string, unknown>;
  occurredAt: ISODateTime;
  idempotencyKey: string;
}

export type HumanRequestType = "identity_verification" | "account_creation" | "payment_setup" | "legal_acceptance" | "missing_information" | "subjective_review" | "customer_escalation";
export interface HumanRequestRecord extends Scope {
  id: UUID;
  workflowId: UUID;
  taskId?: UUID;
  requestType: HumanRequestType;
  title: string;
  exactAction: string;
  continuation: string;
  status: "open" | "completed" | "cancelled";
  requiredRole: "CEO" | "finance operator" | "human operator" | "reviewer";
  createdAt: ISODateTime;
  respondedAt?: ISODateTime;
}

export type FeedbackCategory = "correction" | "preference" | "decision" | "explanation" | "policy_proposal";
export type FeedbackTarget = "assistant_behavior" | "agent_behavior" | "human_team" | "procedure" | "policy";
export type FeedbackPersistence = "one_time" | "durable";
export type FeedbackSource = "control_panel" | "codex_conversation" | "human_request" | "review";
export type FeedbackStatus = "pending_confirmation" | "confirmed" | "rejected" | "converted" | "expired";
export type PreferenceStatus = "proposed" | "active" | "superseded" | "expired" | "rejected" | "requires_policy_review";
export type PreferenceAppliesTo = "codex" | "agents" | "human_team" | "control_plane";

export interface HumanFeedback extends Scope {
  id: UUID;
  submittedByHumanId: UUID;
  source: FeedbackSource;
  category: FeedbackCategory;
  target: FeedbackTarget;
  statement: string;
  context: string;
  persistence: FeedbackPersistence;
  provenance: string;
  status: FeedbackStatus;
  submittedAt: ISODateTime;
  confirmedByHumanId?: UUID;
  confirmedAt?: ISODateTime;
  rejectionReason?: string;
  reviewAt?: ISODateTime;
  expiresAt?: ISODateTime;
}

export interface PreferenceRecord extends Scope {
  id: UUID;
  sourceFeedbackId: UUID;
  key: string;
  version: number;
  statement: string;
  rationale: string;
  appliesTo: PreferenceAppliesTo;
  status: PreferenceStatus;
  createdByHumanId: UUID;
  approvedByHumanId?: UUID;
  createdAt: ISODateTime;
  effectiveAt?: ISODateTime;
  reviewAt?: ISODateTime;
  expiresAt?: ISODateTime;
  supersedesPreferenceId?: UUID;
  authorityEffect: "none";
}

export type FeedbackEventType = "submitted" | "confirmed" | "rejected" | "preference_proposed" | "preference_activated" | "preference_superseded" | "expired";
export interface FeedbackEvent extends Scope { id: UUID; feedbackId: UUID; preferenceId?: UUID; actorHumanId: UUID; eventType: FeedbackEventType; details: string; occurredAt: ISODateTime; }

export type OodaPhase = "observe" | "orient" | "decide" | "act";
export type OodaLoopKind = "company" | "business_unit" | "harness" | "objective" | "workflow" | "agent";
export type OodaLoopStatus = "active" | "paused" | "completed" | "retired";
export type OodaReviewOutcome = "continue" | "adjust" | "rollback" | "stop";

export interface OodaLoopManifest extends Scope {
  id: UUID;
  parentLoopId?: UUID;
  kind: OodaLoopKind;
  name: string;
  objective: string;
  ownerId: UUID;
  currentPhase: OodaPhase;
  cycleNumber: number;
  cadence: string;
  status: OodaLoopStatus;
  nextReviewAt: ISODateTime;
}

export interface OodaObservation extends Scope { id: UUID; loopId: UUID; cycleNumber: number; source: string; evidence: string; confidence: number; observedAt: ISODateTime; }
export interface OodaOrientation extends Scope { id: UUID; loopId: UUID; cycleNumber: number; constraints: string[]; hypotheses: string[]; risks: string[]; orientedAt: ISODateTime; }
export interface OodaDecision extends Scope { id: UUID; loopId: UUID; cycleNumber: number; chosenAction: string; alternatives: string[]; rationale: string; decidedAt: ISODateTime; }
export interface OodaAction extends Scope { id: UUID; loopId: UUID; cycleNumber: number; action: string; ownerId: UUID; status: "planned" | "running" | "completed" | "failed" | "rolled_back"; actedAt: ISODateTime; }
export interface OodaReview extends Scope { id: UUID; loopId: UUID; cycleNumber: number; outcome: OodaReviewOutcome; findings: string[]; metricChanges: Record<string, number>; followUpActions: string[]; reviewedBy: UUID; reviewedAt: ISODateTime; }
