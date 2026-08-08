import { describe, expect, it } from "vitest";
import { createInitialPmState } from "./pm-model";

describe("PM read model", () => {
  it("seeds the CEO overview with linked operational records", () => {
    const state = createInitialPmState();

    expect(state.tasks.length).toBeGreaterThan(0);
    expect(state.tasks.every((task) => task.workflowId && task.objectiveId)).toBe(true);
    expect(state.approvals.filter((approval) => approval.status === "pending")).toHaveLength(3);
    expect(state.humanRequests.filter((request) => request.status === "open")).toHaveLength(2);
    expect(new Set(state.events.map((event) => event.id)).size).toBe(state.events.length);
  });
});
