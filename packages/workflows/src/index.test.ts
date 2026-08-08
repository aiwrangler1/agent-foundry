import { describe, expect, it } from "vitest";
import { createInMemoryFilingQuestionPersistence } from "@agent-foundry/db";
import type { OodaLoopManifest, OodaReview } from "@agent-foundry/domain";
import type { AuthoritativeFilingSource, AuthoritativeFilingSourceRetriever, AuthoritativeTaxSource, AuthoritativeTaxSourceRetriever, HarnessAgent, ModelRouter } from "@agent-foundry/integrations";
import { advanceOodaPhase, answerFilingQuestion, beginNextOodaCycle, createNestedOodaLoop } from "./index";

const loop: OodaLoopManifest = { organizationId: "org", id: "loop:harness", kind: "harness", name: "Harness roadmap", objective: "Improve safe agent execution", ownerId: "human:founder", currentPhase: "observe", cycleNumber: 1, cadence: "weekly", status: "active", nextReviewAt: "2026-08-13T00:00:00Z" };
const review: OodaReview = { organizationId: "org", id: "review:1", loopId: loop.id, cycleNumber: 1, outcome: "adjust", findings: ["Codex tool filtering is incomplete."], metricChanges: { failedRuns: -1 }, followUpActions: ["Keep risky tools in the gateway."], reviewedBy: "human:founder", reviewedAt: "2026-08-13T00:00:00Z" };

describe("stacked OODA loops", () => {
  it("requires the observe-orient-decide-act sequence", () => {
    const oriented = advanceOodaPhase(loop, "observe");
    const decided = advanceOodaPhase(oriented, "orient");
    const acted = advanceOodaPhase(decided, "decide");
    expect(acted.currentPhase).toBe("act");
    expect(() => advanceOodaPhase(acted, "act")).toThrow("ooda_act_requires_review_before_next_cycle");
  });

  it("requires a matching review before beginning the next cycle", () => {
    const acted = { ...loop, currentPhase: "act" as const };
    expect(beginNextOodaCycle(acted, review).currentPhase).toBe("observe");
    expect(beginNextOodaCycle(acted, review).cycleNumber).toBe(2);
    expect(beginNextOodaCycle(acted, { ...review, outcome: "stop" }).status).toBe("completed");
  });

  it("keeps nested loops in the same organization and explicit parentage", () => {
    const child: OodaLoopManifest = { ...loop, id: "loop:objective", kind: "objective", parentLoopId: loop.id };
    expect(createNestedOodaLoop(loop, child)).toEqual(child);
    expect(() => createNestedOodaLoop(loop, { ...child, parentLoopId: "loop:other" })).toThrow("ooda_child_parent_mismatch");
  });
});

const source: AuthoritativeFilingSource = {
  id: "source:sec:10-k",
  title: "Example Corp 2025 Form 10-K",
  url: "https://www.sec.gov/Archives/example-10-k.htm",
  publisher: "SEC EDGAR",
  documentType: "10-K",
  retrievedAt: "2026-08-06T12:00:00.000Z",
  snippet: "Example Corp reports one class of common stock and describes risk factors.",
  facts: ["Example Corp filed a 2025 Form 10-K", "The 10-K discloses one class of common stock"],
  confidence: 0.95
};

const taxSource: AuthoritativeTaxSource = {
  id: "source:ny-tax:sales-tax",
  title: "New York sales tax guidance for vendors",
  url: "https://www.tax.ny.gov/bus/st/register.htm",
  publisher: "New York State Department of Taxation and Finance",
  jurisdiction: "New York",
  sourceType: "tax-guidance",
  retrievedAt: "2026-08-06T12:00:00.000Z",
  snippet: "Businesses should determine whether they must register as sales tax vendors before making taxable sales.",
  facts: ["New York publishes sales tax vendor registration guidance", "Sales tax duties depend on taxable sales and jurisdictional facts"],
  confidence: 0.9
};

function filingRuntime(events: string[], sources: AuthoritativeFilingSource[] = [source]) {
  const authoritativeSources: AuthoritativeFilingSourceRetriever = { async retrieve() { events.push("retrieve"); return sources; } };
  const modelRouter: ModelRouter = { async select(input) { events.push(`select:${input.taskClass}`); return { model: input.taskClass.includes("stronger") ? "qualified-stronger-model" : "qualified-inexpensive-model", qualified: true, estimatedCostMinor: input.taskClass.includes("stronger") ? 25 : 5 }; } };
  const harnessAgent: HarnessAgent = { name: "ai-sdk-harness-agent", experimental: true, nativeToolFiltering: false, nativeApprovalRequests: false, async invoke(task) { events.push(`invoke:${task.readOnlyTools.map((tool) => tool.actionClass).join(",")}`); return { output: `model answer for ${task.taskId}`, proposedGatewayActions: [], model: "runtime-model", costMinor: 7 }; } };
  return { authoritativeSources, modelRouter, harnessAgent, now: () => new Date("2026-08-06T12:00:00.000Z") };
}

function taxReviewerRuntime(events: string[], taxSources: AuthoritativeTaxSource[] = [taxSource]) {
  const captured: Array<{ jurisdictions: string[]; knownFilingFacts?: string[] }> = [];
  const authoritativeSources: AuthoritativeTaxSourceRetriever = { async retrieve(input) { events.push("tax-retrieve"); captured.push({ jurisdictions: input.jurisdictions, ...(input.knownFilingFacts ? { knownFilingFacts: input.knownFilingFacts } : {}) }); return taxSources; } };
  return { authoritativeSources, jurisdictions: ["United States", "New York", "Erie County, New York"], entityType: "New York single-member LLC", businessActivities: ["bootstrapped software control plane"], maxCostMinor: 40, captured };
}

describe("CEO filing question workflow", () => {
  it("retrieves authoritative sources before model use and runs shadow/read-only with citations", async () => {
    const events: string[] = [];
    const result = await answerFilingQuestion({
      organizationId: "org",
      taskId: "task:filing",
      question: "What filing facts should the CEO know from Example Corp's 10-K?",
      actorId: "human:ceo",
      actorRole: "CEO",
      capability: "filing-research",
      companyName: "Example Corp",
      formTypes: ["10-K"],
      maxInitialCostMinor: 10,
      maxEscalationCostMinor: 50
    }, filingRuntime(events));

    expect(events).toEqual(["retrieve", "select:ceo_filing_question_shadow_research", "invoke:CLASS_0_READ_ONLY,CLASS_0_READ_ONLY,CLASS_0_READ_ONLY", "select:ceo_filing_question_stronger_model_review", "invoke:CLASS_0_READ_ONLY,CLASS_0_READ_ONLY,CLASS_0_READ_ONLY"]);
    expect(result.route).toMatchObject({ ownerRole: "CEO", capability: "filing-research", executionMode: "shadow_read_only" });
    expect(result.route.readOnlyTools.every((tool) => tool.actionClass === "CLASS_0_READ_ONLY")).toBe(true);
    expect(result.answer.citations).toEqual([{ sourceId: source.id, title: source.title, url: source.url, publisher: source.publisher, documentType: source.documentType, retrievedAt: source.retrievedAt }]);
    expect(result.answer.facts).toContain("Example Corp filed a 2025 Form 10-K [source:sec:10-k]");
    expect(result.answer.assumptions[0]).toContain("does not submit filings");
    expect(result.answer.hypotheses).toHaveLength(1);
    expect(result.answer.unresolvedQuestions).toHaveLength(1);
    expect(result.modelEscalation).toMatchObject({ attempted: true, fromModel: "qualified-inexpensive-model", toModel: "qualified-stronger-model" });
    expect(result.trace.ooda.child.parentLoopId).toBe(result.trace.ooda.parent.id);
    expect(result.trace.auditEvents.map((event) => event.eventType)).toEqual(["task_intake_routed", "authoritative_sources_retrieved", "harness_shadow_invoked"]);
    expect(result.trace.cost.modelOutput).toBe(14);
    expect(result.trace.provenance).toEqual(["SEC EDGAR:10-K:https://www.sec.gov/Archives/example-10-k.htm"]);
  });

  it("rejects non-CEO or non-filing-research intake", async () => {
    const events: string[] = [];
    await expect(answerFilingQuestion({ organizationId: "org", taskId: "task:filing", question: "What does this 10-K say about shares?", actorId: "human:cfo", actorRole: "CFO" as "CEO", capability: "filing-research", maxInitialCostMinor: 10, maxEscalationCostMinor: 50 }, filingRuntime(events))).rejects.toThrow("filing_question_requires_ceo_actor");
    await expect(answerFilingQuestion({ organizationId: "org", taskId: "task:filing", question: "What does this 10-K say about shares?", actorId: "human:ceo", actorRole: "CEO", capability: "general-research" as "filing-research", maxInitialCostMinor: 10, maxEscalationCostMinor: 50 }, filingRuntime(events))).rejects.toThrow("filing_question_requires_filing_research_capability");
    expect(events).toEqual([]);
  });

  it("does not invoke proposed filing submission, payment, or permission writes", async () => {
    const events: string[] = [];
    const runtime = filingRuntime(events);
    const harnessAgent: HarnessAgent = { ...runtime.harnessAgent, async invoke() { events.push("invoke:forbidden-proposal"); return { output: "bad proposal", proposedGatewayActions: [{ toolId: "filing-submission", action: "submit", arguments: {}, requiresGatewayAuthorization: true }], model: "runtime-model", costMinor: 1 }; } };
    await expect(answerFilingQuestion({ organizationId: "org", taskId: "task:filing", question: "Should we submit this filing?", actorId: "human:ceo", actorRole: "CEO", capability: "filing-research", maxInitialCostMinor: 10, maxEscalationCostMinor: 50 }, { ...runtime, harnessAgent })).rejects.toThrow("filing_write_action_proposed_in_read_only_path");
    expect(events).toEqual(["retrieve", "select:ceo_filing_question_shadow_research", "invoke:forbidden-proposal"]);
  });

  it("persists the objective, workflow, evidence, cost, audit, and OODA trace when configured", async () => {
    const persistence = createInMemoryFilingQuestionPersistence();
    const result = await answerFilingQuestion({
      organizationId: "org",
      taskId: "task:persisted-filing",
      question: "What filing facts should the CEO know from Example Corp's 10-K?",
      actorId: "human:ceo",
      actorRole: "CEO",
      capability: "filing-research",
      maxInitialCostMinor: 10,
      maxEscalationCostMinor: 50,
    }, { ...filingRuntime([]), persistence });

    const objectiveId = "objective:filing-question:task:persisted-filing";
    expect(await persistence.objectives.get(objectiveId)).toMatchObject({ status: "completed", latestWorkflowRunId: result.route.workflowId });
    expect(await persistence.workflows.listByObjective(objectiveId)).toHaveLength(1);
    expect(await persistence.provenance.listByObjective(objectiveId)).toHaveLength(1);
    expect(await persistence.audits.listByObject("workflow", result.route.workflowId)).toHaveLength(3);
    expect(await persistence.costs.summarizeObjectiveCost(objectiveId)).toMatchObject({ modelOutput: 14 });
    expect((await persistence.ooda.getCycle(result.trace.ooda.child.id, 1)).actions).toHaveLength(1);
  });

  it("optionally routes tax-relevant filing questions through a read-only tax reviewer with CPA escalation", async () => {
    const events: string[] = [];
    const taxReviewer = taxReviewerRuntime(events);
    const result = await answerFilingQuestion({
      organizationId: "org",
      taskId: "task:sales-tax-filing",
      question: "For a New York LLC, what sales tax filing facts and unresolved questions should the CEO know?",
      actorId: "human:ceo",
      actorRole: "CEO",
      capability: "filing-research",
      maxInitialCostMinor: 10,
      maxEscalationCostMinor: 50
    }, { ...filingRuntime(events), taxReviewer });

    expect(events).toEqual(["retrieve", "select:ceo_filing_question_shadow_research", "invoke:CLASS_0_READ_ONLY,CLASS_0_READ_ONLY,CLASS_0_READ_ONLY", "select:ceo_filing_question_stronger_model_review", "invoke:CLASS_0_READ_ONLY,CLASS_0_READ_ONLY,CLASS_0_READ_ONLY", "tax-retrieve", "select:ceo_filing_question_tax_research_review", "invoke:CLASS_0_READ_ONLY,CLASS_0_READ_ONLY,CLASS_0_READ_ONLY"]);
    expect(taxReviewer.captured[0]).toMatchObject({ jurisdictions: ["United States", "New York", "Erie County, New York"], knownFilingFacts: source.facts });
    expect(result.route).toMatchObject({ ownerRole: "CEO", capability: "filing-research" });
    expect(result.taxReview?.route).toMatchObject({ ownerRole: "CEO", capability: "tax-research-review", executionMode: "shadow_read_only" });
    expect(result.taxReview?.route.readOnlyTools.every((tool) => tool.actionClass === "CLASS_0_READ_ONLY")).toBe(true);
    expect(result.taxReview?.facts).toContain("New York: New York publishes sales tax vendor registration guidance [source:ny-tax:sales-tax]");
    expect(result.taxReview?.assumptions[0]).toContain("does not register for tax accounts");
    expect(result.taxReview?.unresolvedQuestions).toContain("Where customers are located, how sales are delivered, and whether sales-tax nexus thresholds or marketplace rules apply.");
    expect(result.taxReview?.cpaEscalation).toMatchObject({ required: true });
    expect(result.answer.taxReview).toBe(result.taxReview);
    expect(result.trace.auditEvents.map((event) => event.eventType)).toEqual(["task_intake_routed", "authoritative_sources_retrieved", "harness_shadow_invoked", "tax_research_reviewer_invoked"]);
    expect(result.trace.cost.modelOutput).toBe(21);
    expect(result.trace.provenance).toContain("New York State Department of Taxation and Finance:tax-guidance:https://www.tax.ny.gov/bus/st/register.htm");
  });

  it("preserves filing behavior when tax reviewer is configured but the question is not tax relevant", async () => {
    const events: string[] = [];
    const result = await answerFilingQuestion({
      organizationId: "org",
      taskId: "task:plain-filing",
      question: "What filing facts should the CEO know from Example Corp's 10-K?",
      actorId: "human:ceo",
      actorRole: "CEO",
      capability: "filing-research",
      maxInitialCostMinor: 10,
      maxEscalationCostMinor: 50
    }, { ...filingRuntime(events), taxReviewer: taxReviewerRuntime(events) });

    expect(result.taxReview).toBeUndefined();
    expect(events).toEqual(["retrieve", "select:ceo_filing_question_shadow_research", "invoke:CLASS_0_READ_ONLY,CLASS_0_READ_ONLY,CLASS_0_READ_ONLY", "select:ceo_filing_question_stronger_model_review", "invoke:CLASS_0_READ_ONLY,CLASS_0_READ_ONLY,CLASS_0_READ_ONLY"]);
  });

  it("rejects tax reviewer registration, filing, payment, election, or write proposals", async () => {
    const events: string[] = [];
    const runtime = filingRuntime(events);
    const harnessAgent: HarnessAgent = {
      ...runtime.harnessAgent,
      async invoke(task) {
        if (task.taskId.startsWith("task:tax-reviewer")) {
          events.push("invoke:forbidden-tax-proposal");
          return { output: "bad tax proposal", proposedGatewayActions: [{ toolId: "tax-registration", action: "register_sales_tax", arguments: {}, requiresGatewayAuthorization: true }], model: "runtime-model", costMinor: 1 };
        }
        events.push("invoke:filing-ok");
        return { output: "model answer", proposedGatewayActions: [], model: "runtime-model", costMinor: 1 };
      }
    };

    await expect(answerFilingQuestion({
      organizationId: "org",
      taskId: "task:tax-write-blocked",
      question: "Should this New York LLC register for sales tax or make an S-corp election?",
      actorId: "human:ceo",
      actorRole: "CEO",
      capability: "filing-research",
      maxInitialCostMinor: 10,
      maxEscalationCostMinor: 50
    }, { ...runtime, harnessAgent, taxReviewer: { ...taxReviewerRuntime(events), harnessAgent } })).rejects.toThrow("tax_write_action_proposed_in_read_only_path");
    expect(events).toEqual(["retrieve", "select:ceo_filing_question_shadow_research", "invoke:filing-ok", "select:ceo_filing_question_stronger_model_review", "invoke:filing-ok", "tax-retrieve", "select:ceo_filing_question_tax_research_review", "invoke:forbidden-tax-proposal"]);
  });
});
