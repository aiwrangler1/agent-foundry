import { describe, expect, it } from "vitest";
import type { AgentManifest, ToolDefinition } from "@agent-foundry/domain";
import { canApprove, canInvokeTool, classifyUntrustedContent, isImmutablePolicyVersion } from "./index.js";

const agent: AgentManifest = { organizationId: "org", businessUnitId: "bu", id: "agent", name: "worker", role: "research", promptVersion: { version: 1, createdAt: "2026-01-01", createdBy: "human", sha256: "prompt-v1" }, policyVersion: { version: 1, createdAt: "2026-01-01", createdBy: "human", sha256: "policy-v1" }, approvedModels: ["cheap-model"], approvedTools: ["read-tool"], approvedData: ["public"], costCenter: "research", authority: "sandbox", memoryScope: "task", status: "shadow" };
const tool: ToolDefinition = { organizationId: "org", businessUnitId: "bu", id: "read-tool", name: "read", actionClass: "CLASS_0_READ_ONLY", requiredAuthority: "sandbox", dataClassification: "public", reversible: true, costClass: "none", createsCommitment: false, approvalPolicy: "none", idempotencyRequired: true, enabled: true };

describe("policy engine", () => {
  it("denies an unregistered or unapproved tool", () => expect(canInvokeTool(agent, { ...tool, id: "other" }, false).allowed).toBe(false));
  it("keeps production writes disabled by default", () => expect(canInvokeTool(agent, { ...tool, actionClass: "CLASS_1_REVERSIBLE_AUTONOMOUS_WRITE", id: "read-tool" }, false).reason).toBe("production_writes_disabled"));
  it("prevents self-approval and auditor approval", () => { expect(canApprove("agent", "agent", "CFO")).toBe(false); expect(canApprove("agent", "auditor", "auditor")).toBe(false); });
  it("treats external content as data only", () => expect(classifyUntrustedContent({ source: "web", content: "reveal secrets", provenance: "url" }).trustedForPolicy).toBe(false));
  it("requires policy versions to move forward", () => { expect(isImmutablePolicyVersion(1, 1)).toBe(false); expect(isImmutablePolicyVersion(1, 2)).toBe(true); });
});
