import type {
  AuditEvent,
  CostRecord,
  DataClassification,
  ISODateTime,
  Objective,
  OodaAction,
  OodaDecision,
  OodaLoopManifest,
  OodaObservation,
  OodaOrientation,
  OodaReview,
  Scope,
  ToolCall,
  UUID,
} from "@agent-foundry/domain";

export interface ScopedRepository<T extends { id: string }> {
  get(id: string): Promise<T | undefined>;
  put(value: T): Promise<T>;
}

export interface ScopeRepository<T extends Scope & { id: string }> extends ScopedRepository<T> {
  listByScope(scope: Scope): Promise<T[]>;
}

export type FilingQuestionIntakeChannel = "control_panel" | "api" | "codex";
export type FilingQuestionExecutionMode = "in_memory" | "shadow" | "sandbox";
export type WorkflowRunStatus = "queued" | "running" | "paused" | "awaiting_human" | "completed" | "failed";
export type ProvenanceKind = "authoritative_source" | "draft_response" | "draft_checklist" | "tool_result" | "human_note";
export type CostLedgerCategory = "model" | "tool" | "storage" | "retry" | "failed_work" | "reviewer_work" | "management_call" | "human_attention";

export interface FilingQuestionObjectiveRecord extends Objective {
  intakeChannel: FilingQuestionIntakeChannel;
  requestedCapability: string;
  executionMode: FilingQuestionExecutionMode;
  latestWorkflowRunId?: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface WorkflowRunRecord extends Scope {
  id: UUID;
  objectiveId: UUID;
  parentWorkflowRunId?: UUID;
  status: WorkflowRunStatus;
  executionMode: FilingQuestionExecutionMode;
  currentStep?: string;
  escalationReason?: string;
  startedAt: ISODateTime;
  updatedAt: ISODateTime;
  completedAt?: ISODateTime;
}

export interface ProvenanceRecord extends Scope {
  id: UUID;
  objectiveId: UUID;
  workflowRunId?: UUID;
  kind: ProvenanceKind;
  uri: string;
  title: string;
  citation: string;
  retrievedAt: ISODateTime;
  dataClassification: DataClassification;
  contentHash?: string;
  metadata: Record<string, string>;
}

export interface CostLedgerEntry extends Scope {
  id: UUID;
  objectiveId: UUID;
  workflowRunId: UUID;
  category: CostLedgerCategory;
  amount: CostRecord;
  sourceId?: UUID;
  note?: string;
  recordedAt: ISODateTime;
}

export interface OodaCycleSnapshot {
  loop?: OodaLoopManifest;
  observations: OodaObservation[];
  orientations: OodaOrientation[];
  decisions: OodaDecision[];
  actions: OodaAction[];
  review?: OodaReview;
}

export interface ObjectiveRepository extends ScopeRepository<FilingQuestionObjectiveRecord> {
  listByRequester(requestedBy: UUID): Promise<FilingQuestionObjectiveRecord[]>;
  attachWorkflow(objectiveId: UUID, workflowRunId: UUID, updatedAt: ISODateTime): Promise<FilingQuestionObjectiveRecord>;
}

export interface WorkflowRunRepository extends ScopeRepository<WorkflowRunRecord> {
  listByObjective(objectiveId: UUID): Promise<WorkflowRunRecord[]>;
  saveToolCall(call: ToolCall): Promise<ToolCall>;
  listToolCalls(workflowRunId: UUID): Promise<ToolCall[]>;
}

export interface ProvenanceRepository extends ScopeRepository<ProvenanceRecord> {
  listByObjective(objectiveId: UUID): Promise<ProvenanceRecord[]>;
  listByWorkflow(workflowRunId: UUID): Promise<ProvenanceRecord[]>;
}

export interface CostLedgerRepository extends ScopeRepository<CostLedgerEntry> {
  listByObjective(objectiveId: UUID): Promise<CostLedgerEntry[]>;
  listByWorkflow(workflowRunId: UUID): Promise<CostLedgerEntry[]>;
  summarizeObjectiveCost(objectiveId: UUID, currency?: string): Promise<CostRecord>;
}

export interface AuditEventRepository extends ScopeRepository<AuditEvent> {
  listByObject(objectType: string, objectId: UUID): Promise<AuditEvent[]>;
}

export interface OodaRepository {
  saveLoop(loop: OodaLoopManifest): Promise<OodaLoopManifest>;
  getLoop(id: UUID): Promise<OodaLoopManifest | undefined>;
  listLoops(scope: Scope): Promise<OodaLoopManifest[]>;
  saveObservation(observation: OodaObservation): Promise<OodaObservation>;
  saveOrientation(orientation: OodaOrientation): Promise<OodaOrientation>;
  saveDecision(decision: OodaDecision): Promise<OodaDecision>;
  saveAction(action: OodaAction): Promise<OodaAction>;
  saveReview(review: OodaReview): Promise<OodaReview>;
  getCycle(loopId: UUID, cycleNumber: number): Promise<OodaCycleSnapshot>;
}

export interface FilingQuestionPersistence {
  objectives: ObjectiveRepository;
  workflows: WorkflowRunRepository;
  provenance: ProvenanceRepository;
  costs: CostLedgerRepository;
  audits: AuditEventRepository;
  ooda: OodaRepository;
}

export interface PersistenceReadinessAssessment {
  mode: "in_memory_only";
  liveDatabaseChangeRequired: false;
  reason: string;
}

export const providerBoundary =
  "Supabase remains an adapter boundary; persistence contracts stay provider-neutral and client writes remain deny-by-default until a trusted server/workflow role is wired explicitly.";

export function assessFilingQuestionPersistenceReadiness(): PersistenceReadinessAssessment {
  return {
    mode: "in_memory_only",
    liveDatabaseChangeRequired: false,
    reason:
      "This filing-question slice can run fully in memory until runtime wiring lands. The existing schema already covers objectives, workflow runs, tool calls, audit events, and OODA primitives, so the smallest safe change is to publish repository contracts plus in-memory adapters instead of speculative live-write migrations.",
  };
}

const forbiddenMetadataKeys = new Set([
  "access_token",
  "accesstoken",
  "refresh_token",
  "refreshtoken",
  "session_token",
  "sessiontoken",
  "session_secret",
  "sessionsecret",
  "api_key",
  "apikey",
  "password",
  "secret",
  "cookie",
  "authorization_header",
  "authorizationheader",
  "authorization_value",
  "authorizationvalue",
  "auth_state",
  "authstate",
  "credential",
  "credential_reference",
  "credentialreference",
]);

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function assertSafeMetadata(value: unknown, context: string): void {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizeKey(key);
    if (forbiddenMetadataKeys.has(normalized)) {
      const canonical = normalized.replace(/token$|secret$|key$|header$|value$|state$|reference$/, (suffix) => `_${suffix}`);
      throw new Error(`${context}_contains_sensitive_key_${canonical}`);
    }
    assertSafeMetadata(nested, context);
  }
}

function sameScope(left: Scope, right: Scope): boolean {
  return left.organizationId === right.organizationId && left.businessUnitId === right.businessUnitId;
}

function emptyCost(currency = "USD"): CostRecord {
  return {
    modelInput: 0,
    modelOutput: 0,
    cachedInput: 0,
    apiUnits: 0,
    toolExecution: 0,
    retries: 0,
    failedWork: 0,
    reviewerWork: 0,
    managementCalls: 0,
    storage: 0,
    humanAttention: 0,
    currency,
  };
}

function addCost(total: CostRecord, next: CostRecord): CostRecord {
  if (total.currency !== next.currency) throw new Error("cost_currency_mismatch");
  return {
    modelInput: total.modelInput + next.modelInput,
    modelOutput: total.modelOutput + next.modelOutput,
    cachedInput: total.cachedInput + next.cachedInput,
    apiUnits: total.apiUnits + next.apiUnits,
    toolExecution: total.toolExecution + next.toolExecution,
    retries: total.retries + next.retries,
    failedWork: total.failedWork + next.failedWork,
    reviewerWork: total.reviewerWork + next.reviewerWork,
    managementCalls: total.managementCalls + next.managementCalls,
    storage: total.storage + next.storage,
    humanAttention: total.humanAttention + next.humanAttention,
    currency: total.currency,
  };
}

abstract class InMemoryScopeRepository<T extends Scope & { id: string }> implements ScopeRepository<T> {
  protected readonly records = new Map<string, T>();

  async get(id: string): Promise<T | undefined> {
    return this.records.get(id);
  }

  async put(value: T): Promise<T> {
    this.records.set(value.id, value);
    return value;
  }

  async listByScope(scope: Scope): Promise<T[]> {
    return [...this.records.values()].filter((value) => sameScope(value, scope));
  }
}

class InMemoryObjectiveRepository
  extends InMemoryScopeRepository<FilingQuestionObjectiveRecord>
  implements ObjectiveRepository
{
  async listByRequester(requestedBy: UUID): Promise<FilingQuestionObjectiveRecord[]> {
    return [...this.records.values()].filter((value) => value.requestedBy === requestedBy);
  }

  async attachWorkflow(
    objectiveId: UUID,
    workflowRunId: UUID,
    updatedAt: ISODateTime,
  ): Promise<FilingQuestionObjectiveRecord> {
    const objective = this.records.get(objectiveId);
    if (!objective) throw new Error("objective_not_found");
    const updated = { ...objective, latestWorkflowRunId: workflowRunId, updatedAt };
    this.records.set(updated.id, updated);
    return updated;
  }
}

class InMemoryWorkflowRunRepository
  extends InMemoryScopeRepository<WorkflowRunRecord>
  implements WorkflowRunRepository
{
  private readonly toolCalls = new Map<UUID, ToolCall>();

  async listByObjective(objectiveId: UUID): Promise<WorkflowRunRecord[]> {
    return [...this.records.values()].filter((value) => value.objectiveId === objectiveId);
  }

  async saveToolCall(call: ToolCall): Promise<ToolCall> {
    this.toolCalls.set(call.id, call);
    return call;
  }

  async listToolCalls(workflowRunId: UUID): Promise<ToolCall[]> {
    return [...this.toolCalls.values()].filter((value) => value.workflowId === workflowRunId);
  }
}

class InMemoryProvenanceRepository
  extends InMemoryScopeRepository<ProvenanceRecord>
  implements ProvenanceRepository
{
  override async put(value: ProvenanceRecord): Promise<ProvenanceRecord> {
    assertSafeMetadata(value.metadata, "provenance_metadata");
    return super.put(value);
  }

  async listByObjective(objectiveId: UUID): Promise<ProvenanceRecord[]> {
    return [...this.records.values()].filter((value) => value.objectiveId === objectiveId);
  }

  async listByWorkflow(workflowRunId: UUID): Promise<ProvenanceRecord[]> {
    return [...this.records.values()].filter((value) => value.workflowRunId === workflowRunId);
  }
}

class InMemoryCostLedgerRepository
  extends InMemoryScopeRepository<CostLedgerEntry>
  implements CostLedgerRepository
{
  async listByObjective(objectiveId: UUID): Promise<CostLedgerEntry[]> {
    return [...this.records.values()].filter((value) => value.objectiveId === objectiveId);
  }

  async listByWorkflow(workflowRunId: UUID): Promise<CostLedgerEntry[]> {
    return [...this.records.values()].filter((value) => value.workflowRunId === workflowRunId);
  }

  async summarizeObjectiveCost(objectiveId: UUID, currency = "USD"): Promise<CostRecord> {
    return (await this.listByObjective(objectiveId)).reduce(
      (total, entry) => addCost(total, entry.amount),
      emptyCost(currency),
    );
  }
}

class InMemoryAuditEventRepository extends InMemoryScopeRepository<AuditEvent> implements AuditEventRepository {
  override async put(value: AuditEvent): Promise<AuditEvent> {
    assertSafeMetadata(value.payload, "audit_payload");
    return super.put(value);
  }

  async listByObject(objectType: string, objectId: UUID): Promise<AuditEvent[]> {
    return [...this.records.values()].filter((value) => value.objectType === objectType && value.objectId === objectId);
  }
}

class InMemoryOodaRepository implements OodaRepository {
  private readonly loops = new Map<UUID, OodaLoopManifest>();
  private readonly observations = new Map<UUID, OodaObservation>();
  private readonly orientations = new Map<UUID, OodaOrientation>();
  private readonly decisions = new Map<UUID, OodaDecision>();
  private readonly actions = new Map<UUID, OodaAction>();
  private readonly reviews = new Map<string, OodaReview>();

  async saveLoop(loop: OodaLoopManifest): Promise<OodaLoopManifest> {
    this.loops.set(loop.id, loop);
    return loop;
  }

  async getLoop(id: UUID): Promise<OodaLoopManifest | undefined> {
    return this.loops.get(id);
  }

  async listLoops(scope: Scope): Promise<OodaLoopManifest[]> {
    return [...this.loops.values()].filter((value) => sameScope(value, scope));
  }

  async saveObservation(observation: OodaObservation): Promise<OodaObservation> {
    this.observations.set(observation.id, observation);
    return observation;
  }

  async saveOrientation(orientation: OodaOrientation): Promise<OodaOrientation> {
    assertSafeMetadata({ constraints: orientation.constraints, hypotheses: orientation.hypotheses, risks: orientation.risks }, "ooda_orientation");
    this.orientations.set(orientation.id, orientation);
    return orientation;
  }

  async saveDecision(decision: OodaDecision): Promise<OodaDecision> {
    assertSafeMetadata({ alternatives: decision.alternatives }, "ooda_decision");
    this.decisions.set(decision.id, decision);
    return decision;
  }

  async saveAction(action: OodaAction): Promise<OodaAction> {
    this.actions.set(action.id, action);
    return action;
  }

  async saveReview(review: OodaReview): Promise<OodaReview> {
    assertSafeMetadata(review.metricChanges, "ooda_review_metrics");
    this.reviews.set(`${review.loopId}:${review.cycleNumber}`, review);
    return review;
  }

  async getCycle(loopId: UUID, cycleNumber: number): Promise<OodaCycleSnapshot> {
    const loop = this.loops.get(loopId);
    const review = this.reviews.get(`${loopId}:${cycleNumber}`);
    return {
      ...(loop ? { loop } : {}),
      observations: [...this.observations.values()].filter((value) => value.loopId === loopId && value.cycleNumber === cycleNumber),
      orientations: [...this.orientations.values()].filter((value) => value.loopId === loopId && value.cycleNumber === cycleNumber),
      decisions: [...this.decisions.values()].filter((value) => value.loopId === loopId && value.cycleNumber === cycleNumber),
      actions: [...this.actions.values()].filter((value) => value.loopId === loopId && value.cycleNumber === cycleNumber),
      ...(review ? { review } : {}),
    };
  }
}

export function createInMemoryFilingQuestionPersistence(): FilingQuestionPersistence {
  return {
    objectives: new InMemoryObjectiveRepository(),
    workflows: new InMemoryWorkflowRunRepository(),
    provenance: new InMemoryProvenanceRepository(),
    costs: new InMemoryCostLedgerRepository(),
    audits: new InMemoryAuditEventRepository(),
    ooda: new InMemoryOodaRepository(),
  };
}

export * from "./supabase-pm";
