import type {
  FeedbackEvent,
  FeedbackEventType,
  FeedbackPersistence,
  FeedbackSource,
  FeedbackStatus,
  FeedbackTarget,
  HumanFeedback,
  PreferenceAppliesTo,
  PreferenceRecord,
  PreferenceStatus,
  Scope,
  UUID
} from "@agent-foundry/domain";

export interface HumanActor { id: UUID; role: "CEO" | "finance operator" | "human operator" | "reviewer" | "viewer"; }

export interface SubmitFeedbackInput extends Scope {
  submittedByHumanId: UUID;
  source: FeedbackSource;
  category: HumanFeedback["category"];
  target: FeedbackTarget;
  statement: string;
  context: string;
  persistence: FeedbackPersistence;
  provenance: string;
  reviewAt?: string;
  expiresAt?: string;
}

export interface ProposePreferenceInput {
  key: string;
  statement: string;
  rationale: string;
  appliesTo: PreferenceAppliesTo;
  reviewAt?: string;
  expiresAt?: string;
  supersedesPreferenceId?: UUID;
}

export interface FeedbackRepository {
  saveFeedback(feedback: HumanFeedback): Promise<HumanFeedback>;
  getFeedback(id: UUID): Promise<HumanFeedback | undefined>;
  listFeedback(organizationId: UUID): Promise<HumanFeedback[]>;
  savePreference(preference: PreferenceRecord): Promise<PreferenceRecord>;
  getPreference(id: UUID): Promise<PreferenceRecord | undefined>;
  listPreferences(organizationId: UUID): Promise<PreferenceRecord[]>;
  saveEvent(event: FeedbackEvent): Promise<FeedbackEvent>;
  listEvents(organizationId: UUID): Promise<FeedbackEvent[]>;
}

export class InMemoryFeedbackRepository implements FeedbackRepository {
  private readonly feedback = new Map<UUID, HumanFeedback>();
  private readonly preferences = new Map<UUID, PreferenceRecord>();
  private readonly events = new Map<UUID, FeedbackEvent>();

  async saveFeedback(feedback: HumanFeedback): Promise<HumanFeedback> { this.feedback.set(feedback.id, feedback); return feedback; }
  async getFeedback(id: UUID): Promise<HumanFeedback | undefined> { return this.feedback.get(id); }
  async listFeedback(organizationId: UUID): Promise<HumanFeedback[]> { return [...this.feedback.values()].filter((item) => item.organizationId === organizationId); }
  async savePreference(preference: PreferenceRecord): Promise<PreferenceRecord> { this.preferences.set(preference.id, preference); return preference; }
  async getPreference(id: UUID): Promise<PreferenceRecord | undefined> { return this.preferences.get(id); }
  async listPreferences(organizationId: UUID): Promise<PreferenceRecord[]> { return [...this.preferences.values()].filter((item) => item.organizationId === organizationId); }
  async saveEvent(event: FeedbackEvent): Promise<FeedbackEvent> { this.events.set(event.id, event); return event; }
  async listEvents(organizationId: UUID): Promise<FeedbackEvent[]> { return [...this.events.values()].filter((item) => item.organizationId === organizationId); }
}

const humanRoles = new Set<HumanActor["role"]>(["CEO", "finance operator", "human operator", "reviewer", "viewer"]);
const policySensitiveTargets = new Set<FeedbackTarget>(["policy"]);

function assertHuman(actor: HumanActor): void {
  if (!actor.id || !humanRoles.has(actor.role)) throw new Error("human_actor_required");
}

function assertText(value: string, field: string, maxLength: number): void {
  if (!value.trim()) throw new Error(`${field}_required`);
  if (value.length > maxLength) throw new Error(`${field}_too_long`);
}

function id(prefix: string): UUID { return `${prefix}:${crypto.randomUUID()}`; }

function event(input: { feedback: HumanFeedback; actorHumanId: UUID; eventType: FeedbackEventType; details: string; preferenceId?: UUID }): FeedbackEvent {
  return {
    organizationId: input.feedback.organizationId,
    ...(input.feedback.businessUnitId ? { businessUnitId: input.feedback.businessUnitId } : {}),
    id: id("feedback-event"),
    feedbackId: input.feedback.id,
    ...(input.preferenceId ? { preferenceId: input.preferenceId } : {}),
    actorHumanId: input.actorHumanId,
    eventType: input.eventType,
    details: input.details,
    occurredAt: new Date().toISOString()
  };
}

export async function submitFeedback(repository: FeedbackRepository, input: SubmitFeedbackInput): Promise<HumanFeedback> {
  assertText(input.statement, "statement", 4000);
  assertText(input.context, "context", 8000);
  assertText(input.provenance, "provenance", 2000);
  const feedback: HumanFeedback = {
    organizationId: input.organizationId,
    ...(input.businessUnitId ? { businessUnitId: input.businessUnitId } : {}),
    id: id("feedback"),
    submittedByHumanId: input.submittedByHumanId,
    source: input.source,
    category: input.category,
    target: input.target,
    statement: input.statement.trim(),
    context: input.context.trim(),
    persistence: input.persistence,
    provenance: input.provenance.trim(),
    status: "pending_confirmation",
    submittedAt: new Date().toISOString(),
    ...(input.reviewAt ? { reviewAt: input.reviewAt } : {}),
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {})
  };
  await repository.saveFeedback(feedback);
  await repository.saveEvent(event({ feedback, actorHumanId: input.submittedByHumanId, eventType: "submitted", details: "Feedback submitted for explicit human confirmation." }));
  return feedback;
}

export async function confirmFeedback(repository: FeedbackRepository, feedbackId: UUID, actor: HumanActor): Promise<HumanFeedback> {
  assertHuman(actor);
  const feedback = await repository.getFeedback(feedbackId);
  if (!feedback) throw new Error("feedback_not_found");
  if (feedback.status !== "pending_confirmation") throw new Error("feedback_not_pending_confirmation");
  const confirmed: HumanFeedback = { ...feedback, status: "confirmed", confirmedByHumanId: actor.id, confirmedAt: new Date().toISOString() };
  await repository.saveFeedback(confirmed);
  await repository.saveEvent(event({ feedback: confirmed, actorHumanId: actor.id, eventType: "confirmed", details: "Human explicitly confirmed this feedback for governed use." }));
  return confirmed;
}

export async function rejectFeedback(repository: FeedbackRepository, feedbackId: UUID, actor: HumanActor, reason: string): Promise<HumanFeedback> {
  assertHuman(actor);
  assertText(reason, "rejection_reason", 2000);
  const feedback = await repository.getFeedback(feedbackId);
  if (!feedback) throw new Error("feedback_not_found");
  if (feedback.status !== "pending_confirmation") throw new Error("feedback_not_pending_confirmation");
  const rejected: HumanFeedback = { ...feedback, status: "rejected", rejectionReason: reason.trim() };
  await repository.saveFeedback(rejected);
  await repository.saveEvent(event({ feedback: rejected, actorHumanId: actor.id, eventType: "rejected", details: reason.trim() }));
  return rejected;
}

export async function proposePreference(repository: FeedbackRepository, feedbackId: UUID, actor: HumanActor, input: ProposePreferenceInput): Promise<PreferenceRecord> {
  assertHuman(actor);
  assertText(input.key, "preference_key", 200);
  assertText(input.statement, "preference_statement", 4000);
  assertText(input.rationale, "preference_rationale", 4000);
  const feedback = await repository.getFeedback(feedbackId);
  if (!feedback) throw new Error("feedback_not_found");
  if (feedback.status !== "confirmed") throw new Error("feedback_must_be_confirmed_first");
  if (feedback.persistence !== "durable") throw new Error("one_time_feedback_cannot_become_preference");
  const status: PreferenceStatus = policySensitiveTargets.has(feedback.target) ? "requires_policy_review" : "proposed";
  const preference: PreferenceRecord = {
    organizationId: feedback.organizationId,
    ...(feedback.businessUnitId ? { businessUnitId: feedback.businessUnitId } : {}),
    id: id("preference"),
    sourceFeedbackId: feedback.id,
    key: input.key.trim(),
    version: 1,
    statement: input.statement.trim(),
    rationale: input.rationale.trim(),
    appliesTo: input.appliesTo,
    status,
    createdByHumanId: actor.id,
    createdAt: new Date().toISOString(),
    ...(input.reviewAt ? { reviewAt: input.reviewAt } : {}),
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    ...(input.supersedesPreferenceId ? { supersedesPreferenceId: input.supersedesPreferenceId } : {}),
    authorityEffect: "none"
  };
  await repository.savePreference(preference);
  const converted: HumanFeedback = { ...feedback, status: "converted" };
  await repository.saveFeedback(converted);
  await repository.saveEvent(event({ feedback: converted, actorHumanId: actor.id, eventType: "preference_proposed", details: `Preference ${preference.key} proposed with status ${status}.`, preferenceId: preference.id }));
  return preference;
}

export async function activatePreference(repository: FeedbackRepository, preferenceId: UUID, actor: HumanActor, now = new Date()): Promise<PreferenceRecord> {
  assertHuman(actor);
  const preference = await repository.getPreference(preferenceId);
  if (!preference) throw new Error("preference_not_found");
  if (preference.status !== "proposed") throw new Error("preference_not_ready_for_activation");
  if (preference.expiresAt && new Date(preference.expiresAt) <= now) throw new Error("preference_expired");
  const existing = (await repository.listPreferences(preference.organizationId)).find((candidate) =>
    candidate.id !== preference.id && candidate.status === "active" && candidate.key === preference.key &&
    candidate.businessUnitId === preference.businessUnitId && candidate.appliesTo === preference.appliesTo
  );
  if (existing && preference.supersedesPreferenceId !== existing.id) throw new Error("active_preference_conflict_requires_explicit_supersession");
  if (preference.supersedesPreferenceId && (!existing || existing.id !== preference.supersedesPreferenceId)) throw new Error("supersession_target_must_be_active_matching_preference");
  if (existing) await repository.savePreference({ ...existing, status: "superseded" });
  const active: PreferenceRecord = { ...preference, status: "active", approvedByHumanId: actor.id, effectiveAt: now.toISOString() };
  await repository.savePreference(active);
  const feedback = await repository.getFeedback(active.sourceFeedbackId);
  if (feedback) await repository.saveEvent(event({ feedback, actorHumanId: actor.id, eventType: existing ? "preference_superseded" : "preference_activated", details: `Preference ${active.key} activated.`, preferenceId: active.id }));
  return active;
}

export function isPreferenceUsable(preference: PreferenceRecord, now = new Date()): boolean {
  if (preference.status !== "active") return false;
  if (preference.expiresAt && new Date(preference.expiresAt) <= now) return false;
  if (preference.reviewAt && new Date(preference.reviewAt) <= now) return false;
  return preference.authorityEffect === "none";
}

export async function compileRelevantPreferences(repository: FeedbackRepository, scope: Scope, appliesTo: PreferenceAppliesTo, now = new Date()): Promise<PreferenceRecord[]> {
  return (await repository.listPreferences(scope.organizationId))
    .filter((preference) => preference.appliesTo === appliesTo && preference.organizationId === scope.organizationId)
    .filter((preference) => !preference.businessUnitId || preference.businessUnitId === scope.businessUnitId)
    .filter((preference) => isPreferenceUsable(preference, now))
    .sort((left, right) => left.key.localeCompare(right.key) || left.version - right.version);
}

export function feedbackRequiresPolicyReview(feedback: Pick<HumanFeedback, "target">): boolean { return policySensitiveTargets.has(feedback.target); }

export type { FeedbackStatus };
