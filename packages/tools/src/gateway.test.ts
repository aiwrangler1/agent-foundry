import { describe, expect, it } from "vitest";
import type { AgentManifest, ToolDefinition } from "@agent-foundry/domain";
import { ToolGateway } from "./index.js";

const agent: AgentManifest = { organizationId: "org", businessUnitId: "bu", id: "agent", name: "worker", role: "research", promptVersion: { version: 1, createdAt: "2026-01-01", createdBy: "human", sha256: "prompt-v1" }, policyVersion: { version: 1, createdAt: "2026-01-01", createdBy: "human", sha256: "policy-v1" }, approvedModels: [], approvedTools: ["tool"], approvedData: ["public"], costCenter: "cc", authority: "sandbox", memoryScope: "task", status: "shadow" };
const tool: ToolDefinition = { organizationId: "org", businessUnitId: "bu", id: "tool", name: "mock-read", actionClass: "CLASS_0_READ_ONLY", requiredAuthority: "sandbox", dataClassification: "public", reversible: true, costClass: "none", createsCommitment: false, approvalPolicy: "none", idempotencyRequired: true, enabled: true };

describe("tool gateway", () => {
  it("rejects unregistered tools", () => expect(() => new ToolGateway(new Map()).execute({ agent, toolId: "missing", workflowId: "flow", idempotencyKey: "idem", requestedActionClass: "CLASS_0_READ_ONLY" })).toThrow("unregistered_tool"));
  it("replays an idempotent successful call", () => { const gateway = new ToolGateway(new Map([[tool.id, tool]])); const input = { agent, toolId: "tool", workflowId: "flow", idempotencyKey: "idem", requestedActionClass: "CLASS_0_READ_ONLY" as const }; expect(gateway.execute(input)).toBe(gateway.execute(input)); });
});
