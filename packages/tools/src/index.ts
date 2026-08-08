import type { AgentManifest, SpendAuthorization, SpendReservation, ToolDefinition, ToolCall } from "@agent-foundry/domain";
import { authorizeSpend } from "@agent-foundry/finance";
import { canInvokeTool, exceedsActionClass } from "@agent-foundry/policies";

export class ToolGateway {
  private readonly calls = new Map<string, ToolCall>();
  constructor(private readonly tools: Map<string, ToolDefinition>, private readonly productionWritesEnabled = false) {}
  execute(input: { agent: AgentManifest; toolId: string; workflowId: string; idempotencyKey: string; requestedActionClass: ToolCall["actionClass"]; spend?: { authorization: SpendAuthorization; reservation: SpendReservation; amountMinor: number }; }): ToolCall {
    const tool = this.tools.get(input.toolId);
    if (!tool) throw new Error("unregistered_tool");
    const existing = this.calls.get(input.idempotencyKey);
    if (existing) return existing;
    if (exceedsActionClass(tool.actionClass, input.requestedActionClass)) throw new Error("action_class_exceeded");
    const policy = canInvokeTool(input.agent, tool, this.productionWritesEnabled);
    if (!policy.allowed) throw new Error(policy.reason);
    if (tool.costClass !== "none") {
      if (!input.spend) throw new Error("spend_authorization_required");
      const spend = authorizeSpend({ ...input.spend, toolId: tool.id, agentId: input.agent.id, workflowId: input.workflowId, idempotencyKey: input.idempotencyKey, now: new Date() });
      if (!spend.allowed) throw new Error(spend.reason);
    }
    const call: ToolCall = { organizationId: input.agent.organizationId, ...(input.agent.businessUnitId ? { businessUnitId: input.agent.businessUnitId } : {}), id: `call:${input.idempotencyKey}`, toolId: tool.id, agentId: input.agent.id, workflowId: input.workflowId, idempotencyKey: input.idempotencyKey, actionClass: input.requestedActionClass, status: "completed", cost: { modelInput: 0, modelOutput: 0, cachedInput: 0, apiUnits: 0, toolExecution: 0, retries: 0, failedWork: 0, reviewerWork: 0, managementCalls: 0, storage: 0, humanAttention: 0, currency: "USD" } };
    this.calls.set(input.idempotencyKey, call);
    return call;
  }
}
