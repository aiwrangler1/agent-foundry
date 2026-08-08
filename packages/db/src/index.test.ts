import { describe, expect, it } from "vitest";

import { assessFilingQuestionPersistenceReadiness, createInMemoryFilingQuestionPersistence } from "./index";

describe("@agent-foundry/db", () => {
  it("documents this slice as in-memory until runtime wiring exists", () => {
    expect(assessFilingQuestionPersistenceReadiness()).toEqual({
      mode: "in_memory_only",
      liveDatabaseChangeRequired: false,
      reason: expect.stringContaining("smallest safe change"),
    });
  });

  it("persists objective, workflow, provenance, cost, audit, and OODA records in memory", async () => {
    const persistence = createInMemoryFilingQuestionPersistence();
    const scope = { organizationId: "org-1", businessUnitId: "bu-1" };

    await persistence.objectives.put({
      ...scope,
      id: "objective-1",
      title: "Ask the CEO agent a filing question",
      requestedBy: "human-1",
      status: "queued",
      intakeChannel: "control_panel",
      requestedCapability: "filing_research",
      executionMode: "in_memory",
      createdAt: "2026-08-06T12:00:00.000Z",
      updatedAt: "2026-08-06T12:00:00.000Z",
    });

    await persistence.workflows.put({
      ...scope,
      id: "workflow-1",
      objectiveId: "objective-1",
      status: "running",
      executionMode: "in_memory",
      currentStep: "authoritative_retrieval",
      startedAt: "2026-08-06T12:01:00.000Z",
      updatedAt: "2026-08-06T12:01:00.000Z",
    });

    await persistence.objectives.attachWorkflow("objective-1", "workflow-1", "2026-08-06T12:01:00.000Z");

    await persistence.provenance.put({
      ...scope,
      id: "prov-1",
      objectiveId: "objective-1",
      workflowRunId: "workflow-1",
      kind: "authoritative_source",
      uri: "https://www.irs.gov/",
      title: "IRS filing guidance",
      citation: "IRS guidance, accessed 2026-08-06",
      retrievedAt: "2026-08-06T12:02:00.000Z",
      dataClassification: "public",
      metadata: { sourceType: "government" },
    });

    await persistence.costs.put({
      ...scope,
      id: "cost-1",
      objectiveId: "objective-1",
      workflowRunId: "workflow-1",
      category: "model",
      amount: {
        modelInput: 10,
        modelOutput: 20,
        cachedInput: 0,
        apiUnits: 0,
        toolExecution: 0,
        retries: 1,
        failedWork: 0,
        reviewerWork: 0,
        managementCalls: 0,
        storage: 0,
        humanAttention: 0,
        currency: "USD",
      },
      recordedAt: "2026-08-06T12:03:00.000Z",
    });

    await persistence.audits.put({
      ...scope,
      id: "audit-1",
      actorId: "agent-1",
      eventType: "workflow.started",
      objectType: "workflow_run",
      objectId: "workflow-1",
      payload: { mode: "in_memory" },
      occurredAt: "2026-08-06T12:03:30.000Z",
    });

    await persistence.ooda.saveLoop({
      ...scope,
      id: "loop-1",
      parentLoopId: "loop-root",
      kind: "workflow",
      name: "Filing research workflow",
      objective: "Answer a filing question with citations",
      ownerId: "agent-1",
      currentPhase: "observe",
      cycleNumber: 1,
      cadence: "per run",
      status: "active",
      nextReviewAt: "2026-08-06T12:10:00.000Z",
    });

    await persistence.ooda.saveObservation({
      ...scope,
      id: "obs-1",
      loopId: "loop-1",
      cycleNumber: 1,
      source: "irs",
      evidence: "Form instructions retrieved.",
      confidence: 0.95,
      observedAt: "2026-08-06T12:04:00.000Z",
    });

    expect((await persistence.objectives.get("objective-1"))?.latestWorkflowRunId).toBe("workflow-1");
    expect(await persistence.provenance.listByWorkflow("workflow-1")).toHaveLength(1);
    expect(await persistence.audits.listByObject("workflow_run", "workflow-1")).toHaveLength(1);
    expect(await persistence.workflows.listByObjective("objective-1")).toHaveLength(1);
    expect(await persistence.costs.summarizeObjectiveCost("objective-1")).toMatchObject({
      modelInput: 10,
      modelOutput: 20,
      retries: 1,
      currency: "USD",
    });
    expect((await persistence.ooda.getCycle("loop-1", 1)).observations).toHaveLength(1);
  });

  it("rejects secret-bearing provenance metadata", async () => {
    const persistence = createInMemoryFilingQuestionPersistence();

    await expect(
      persistence.provenance.put({
        organizationId: "org-1",
        id: "prov-secret",
        objectiveId: "objective-1",
        kind: "tool_result",
        uri: "memory://tool",
        title: "unsafe",
        citation: "unsafe",
        retrievedAt: "2026-08-06T12:05:00.000Z",
        dataClassification: "restricted",
        metadata: { accessToken: "secret" },
      }),
    ).rejects.toThrow("provenance_metadata_contains_sensitive_key_access_token");
  });
});
