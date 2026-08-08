import { createInitialPmState, type PmAction, type PmWorkspaceState } from "../../pm-model";
import type { PmEvent } from "@agent-foundry/domain";
import { isSupabaseConfigured, getSupabasePmState, applySupabasePmAction } from "@agent-foundry/db";

let workspaceState = createInitialPmState();
let eventSequence = workspaceState.events.length + 1;

type PmEventRecord = PmWorkspaceState["events"][number];
type PmTaskRecord = PmWorkspaceState["tasks"][number];
type PmApprovalRecord = PmWorkspaceState["approvals"][number];
type PmHumanRequestRecord = PmWorkspaceState["humanRequests"][number];
type PmTaskState = Extract<PmAction, { action: "task_status" }>["state"];
type PmPriority = Extract<PmAction, { action: "task_priority" }>["priority"];

function demoModeEnabled() {
  return process.env.CONTROL_PLANE_DEMO_MODE === "true";
}

function requireHumanActor(request: Request) {
  const actorId = request.headers.get("x-human-actor-id");
  if (!actorId) throw new Error("x_human_actor_id_required");
  return actorId;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "pm_request_failed";
  const status =
    message === "demo_mode_write_required"
      ? 503
      : message === "x_human_actor_id_required"
        ? 400
        : message.endsWith("_not_found")
          ? 404
          : 400;

  return Response.json({ ok: false, error: message }, { status });
}

function nextTimestamp() {
  return new Date().toISOString();
}

function appendEvents(state: PmWorkspaceState, actorId: string, specs: Array<{
  type: PmEvent["type"];
  objectType: PmEvent["objectType"];
  objectId: string;
  payload: Record<string, unknown>;
}>, occurredAt: string): PmWorkspaceState {
  const events = specs.map((spec) => ({
    organizationId: "org:agent-foundry",
    businessUnitId: "bu:commerce-lab",
    id: `event:${eventSequence++}`,
    type: spec.type,
    actorId,
    objectType: spec.objectType,
    objectId: spec.objectId,
    payload: spec.payload,
    occurredAt,
    idempotencyKey: `${spec.objectId}:${spec.type}:${occurredAt}`
  } as PmEventRecord));

  return { ...state, events: [...events, ...state.events], generatedAt: occurredAt };
}

function updateTask(
  state: PmWorkspaceState,
  taskId: string,
  mutate: (task: PmTaskRecord) => PmTaskRecord
) {
  let found = false;
  const tasks = state.tasks.map((task) => {
    if (task.id !== taskId) return task;
    found = true;
    return mutate(task);
  });
  if (!found) throw new Error("task_not_found");
  return { ...state, tasks };
}

function syncWorkflowFromTask(state: PmWorkspaceState, taskId: string, occurredAt: string) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task?.workflowId) return state;

  const workflow = state.workflows.find((item) => item.id === task.workflowId);
  if (!workflow) return state;

  const workflowState = (() => {
    switch (task.state) {
      case "in_progress":
      case "review":
        return "running" as const;
      case "blocked":
      case "cancelled":
        return "failed" as const;
      case "complete":
        return "completed" as const;
      case "backlog":
      case "ready":
      case "waiting_on_agent":
      case "waiting_on_human":
      default:
        return "waiting" as const;
    }
  })();

  const currentStep = (() => {
    switch (task.state) {
      case "ready":
        return "Queued to resume";
      case "in_progress":
        return "Routine in progress";
      case "waiting_on_agent":
        return "Awaiting agent continuation";
      case "waiting_on_human":
        return "Awaiting human input";
      case "review":
        return "Human review";
      case "blocked":
        return task.blockedReason ?? "Blocked";
      case "complete":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      case "backlog":
      default:
        return "Backlog";
    }
  })();

  return {
    ...state,
    workflows: state.workflows.map((item) => (
      item.id === workflow.id
        ? {
            ...item,
            state: workflowState,
            currentStep,
            progress: task.progressPercent,
            elapsed: workflowState === "running" ? "just resumed" : item.elapsed,
            steps: item.steps.map((step, index) => {
              if (workflowState === "completed") {
                return { ...step, state: "done" as const };
              }
              if (workflowState === "failed" && index === item.steps.length - 1) {
                return { ...step, state: "error" as const };
              }
              if (workflowState === "running") {
                const currentIndex = item.steps.findIndex((stepItem) => stepItem.state === "current");
                const normalizedIndex = currentIndex >= 0 ? currentIndex : Math.max(item.steps.length - 1, 0);
                if (index < normalizedIndex) return { ...step, state: "done" as const };
                if (index === normalizedIndex) return { ...step, state: "current" as const };
              }
              return step;
            })
          }
        : item
    )),
    generatedAt: occurredAt
  };
}

function updateApproval(state: PmWorkspaceState, approvalId: string, occurredAt: string, status: PmApprovalRecord["status"]) {
  let found = false;
  const approvals = state.approvals.map((approval) => {
    if (approval.id !== approvalId) return approval;
    found = true;
    return { ...approval, status, blocked: status === "pending" };
  });
  if (!found) throw new Error("approval_not_found");
  return { ...state, approvals, generatedAt: occurredAt };
}

function updateHumanRequest(state: PmWorkspaceState, requestId: string, occurredAt: string, status: PmHumanRequestRecord["status"]) {
  let found = false;
  const humanRequests = state.humanRequests.map((request) => {
    if (request.id !== requestId) return request;
    found = true;
    return { ...request, status, respondedAt: occurredAt };
  });
  if (!found) throw new Error("human_request_not_found");
  return { ...state, humanRequests, generatedAt: occurredAt };
}

function applyTaskStatus(state: PmWorkspaceState, action: Extract<PmAction, { action: "task_status" }>, actorId: string, occurredAt: string) {
  const previous = state.tasks.find((task) => task.id === action.taskId);
  if (!previous) throw new Error("task_not_found");

  let next = updateTask(state, action.taskId, (task) => ({
    ...task,
    state: action.state,
    blockedReason: action.state === "blocked" ? (task.blockedReason ?? "Blocked by human update.") : undefined,
    progressPercent:
      action.state === "complete"
        ? 100
        : action.state === "ready"
          ? Math.max(task.progressPercent, 0)
          : task.progressPercent,
    updatedAt: occurredAt
  }));
  next = syncWorkflowFromTask(next, action.taskId, occurredAt);

  return appendEvents(
    next,
    actorId,
    [{
      type: action.state === "in_progress" && previous.state !== "in_progress"
        ? "task.started"
        : action.state === "blocked"
          ? "task.blocked"
          : action.state === "complete"
            ? "task.completed"
            : "task.status_changed",
      objectType: "task",
      objectId: action.taskId,
      payload: {
        previousState: previous.state,
        nextState: action.state,
        summary: `Task moved from ${previous.state} to ${action.state}.`
      }
    }],
    occurredAt
  );
}

function applyTaskPriority(state: PmWorkspaceState, action: Extract<PmAction, { action: "task_priority" }>, actorId: string, occurredAt: string) {
  const previous = state.tasks.find((task) => task.id === action.taskId);
  if (!previous) throw new Error("task_not_found");

  const next = updateTask(state, action.taskId, (task) => ({
    ...task,
    priority: action.priority,
    updatedAt: occurredAt
  }));

  return appendEvents(
    next,
    actorId,
    [{
      type: "task.priority_changed",
      objectType: "task",
      objectId: action.taskId,
      payload: {
        previousPriority: previous.priority,
        nextPriority: action.priority,
        summary: `Task priority changed from ${previous.priority} to ${action.priority}.`
      }
    }],
    occurredAt
  );
}

function applyAddNote(state: PmWorkspaceState, action: Extract<PmAction, { action: "add_note" }>, actorId: string, occurredAt: string) {
  const task = state.tasks.find((item) => item.id === action.taskId);
  if (!task) throw new Error("task_not_found");

  const next = updateTask(state, action.taskId, (current) => ({
    ...current,
    updatedAt: occurredAt
  }));

  return appendEvents(
    next,
    actorId,
    [{
      type: "task.note_added",
      objectType: "task",
      objectId: action.taskId,
      payload: {
        note: action.note,
        summary: `Human note added to ${task.shortId}.`
      }
    }],
    occurredAt
  );
}

function applyApproval(state: PmWorkspaceState, action: Extract<PmAction, { action: "approval" }>, actorId: string, occurredAt: string) {
  const approval = state.approvals.find((item) => item.id === action.approvalId);
  if (!approval) throw new Error("approval_not_found");

  let next = updateApproval(
    state,
    action.approvalId,
    occurredAt,
    action.decision === "approve"
      ? "approved"
      : action.decision === "reject"
        ? "rejected"
        : action.decision === "request_changes"
          ? "changes_requested"
          : "deferred"
  );

  next = updateTask(next, approval.taskId, (task) => ({
    ...task,
    state:
      action.decision === "approve"
        ? "ready"
        : action.decision === "defer"
          ? "waiting_on_human"
          : "blocked",
    blockedReason:
      action.decision === "approve"
        ? undefined
        : action.decision === "defer"
          ? "Approval deferred pending later review."
          : action.decision === "request_changes"
            ? `Changes requested for ${approval.title}.`
            : `Approval rejected for ${approval.title}.`,
    updatedAt: occurredAt
  }));

  next = syncWorkflowFromTask(next, approval.taskId, occurredAt);

  return appendEvents(
    next,
    actorId,
    [{
      type:
        action.decision === "approve"
          ? "approval.approved"
          : action.decision === "reject"
            ? "approval.rejected"
            : action.decision === "request_changes"
              ? "approval.changes_requested"
              : "decision.recorded",
      objectType: "approval",
      objectId: action.approvalId,
      payload: {
        decision: action.decision,
        taskId: approval.taskId,
        summary: `Approval ${approval.id} marked ${action.decision}.`
      }
    }],
    occurredAt
  );
}

function applyHumanRequest(state: PmWorkspaceState, action: Extract<PmAction, { action: "human_request" }>, actorId: string, occurredAt: string) {
  const request = state.humanRequests.find((item) => item.id === action.requestId);
  if (!request) throw new Error("human_request_not_found");

  let next = updateHumanRequest(
    state,
    action.requestId,
    occurredAt,
    action.decision === "complete" ? "completed" : "cancelled"
  );

  if (request.taskId) {
    next = updateTask(next, request.taskId, (task) => ({
      ...task,
      state: action.decision === "complete" ? "ready" : "blocked",
      blockedReason: action.decision === "complete" ? undefined : `Human request ${request.id} was cancelled.`,
      updatedAt: occurredAt
    }));
    next = syncWorkflowFromTask(next, request.taskId, occurredAt);
  }

  return appendEvents(
    next,
    actorId,
    [{
      type: action.decision === "complete" ? "human_request.completed" : "decision.recorded",
      objectType: "human_request",
      objectId: action.requestId,
      payload: {
        decision: action.decision,
        taskId: request.taskId,
        summary: `Human request ${request.id} marked ${action.decision}.`
      }
    }],
    occurredAt
  );
}

function applyRunRoutine(state: PmWorkspaceState, action: Extract<PmAction, { action: "run_routine" }>, actorId: string, occurredAt: string) {
  const task = state.tasks.find((item) => item.id === action.taskId);
  if (!task) throw new Error("task_not_found");

  let next = updateTask(state, action.taskId, (current) => ({
    ...current,
    state: "in_progress",
    blockedReason: undefined,
    progressPercent: Math.min(95, Math.max(current.progressPercent, current.progressPercent + 7)),
    updatedAt: occurredAt
  }));

  next = syncWorkflowFromTask(next, action.taskId, occurredAt);

  const workflowId = task.workflowId;

  return appendEvents(
    next,
    actorId,
    workflowId
      ? [
          {
            type: "workflow.resumed",
            objectType: "workflow",
            objectId: workflowId,
            payload: {
              taskId: action.taskId,
              summary: `Routine resumed for ${task.shortId}.`
            }
          },
          {
            type: task.state === "in_progress" ? "task.status_changed" : "task.started",
            objectType: "task",
            objectId: action.taskId,
            payload: {
              previousState: task.state,
              nextState: "in_progress",
              summary: `Task moved from ${task.state} to in_progress.`
            }
          }
        ]
      : [{
          type: task.state === "in_progress" ? "task.status_changed" : "task.started",
          objectType: "task",
          objectId: action.taskId,
          payload: {
            previousState: task.state,
            nextState: "in_progress",
            summary: `Task moved from ${task.state} to in_progress.`
          }
        }],
    occurredAt
  );
}

function applyAction(state: PmWorkspaceState, action: PmAction, actorId: string, occurredAt: string) {
  switch (action.action) {
    case "task_status":
      return applyTaskStatus(state, action, actorId, occurredAt);
    case "task_priority":
      return applyTaskPriority(state, action, actorId, occurredAt);
    case "add_note":
      return applyAddNote(state, action, actorId, occurredAt);
    case "approval":
      return applyApproval(state, action, actorId, occurredAt);
    case "human_request":
      return applyHumanRequest(state, action, actorId, occurredAt);
    case "run_routine":
      return applyRunRoutine(state, action, actorId, occurredAt);
    default:
      throw new Error("unknown_pm_action");
  }
}

function validateAction(input: unknown): PmAction {
  if (!input || typeof input !== "object") throw new Error("invalid_pm_action");

  const action = (input as Record<string, unknown>).action;
  if (action === "task_status") {
    const state = (input as Record<string, unknown>).state;
    const taskId = (input as Record<string, unknown>).taskId;
    if (typeof taskId !== "string" || typeof state !== "string") throw new Error("invalid_pm_action");
    return { action, taskId, state: state as PmTaskState };
  }
  if (action === "task_priority") {
    const taskId = (input as Record<string, unknown>).taskId;
    const priority = (input as Record<string, unknown>).priority;
    if (typeof taskId !== "string" || typeof priority !== "string") throw new Error("invalid_pm_action");
    return { action, taskId, priority: priority as PmPriority };
  }
  if (action === "add_note") {
    const taskId = (input as Record<string, unknown>).taskId;
    const note = (input as Record<string, unknown>).note;
    if (typeof taskId !== "string" || typeof note !== "string") throw new Error("invalid_pm_action");
    return { action, taskId, note };
  }
  if (action === "approval") {
    const approvalId = (input as Record<string, unknown>).approvalId;
    const decision = (input as Record<string, unknown>).decision;
    if (typeof approvalId !== "string" || typeof decision !== "string") throw new Error("invalid_pm_action");
    return { action, approvalId, decision: decision as Extract<PmAction, { action: "approval" }>["decision"] };
  }
  if (action === "human_request") {
    const requestId = (input as Record<string, unknown>).requestId;
    const decision = (input as Record<string, unknown>).decision;
    if (typeof requestId !== "string" || typeof decision !== "string") throw new Error("invalid_pm_action");
    return { action, requestId, decision: decision as Extract<PmAction, { action: "human_request" }>["decision"] };
  }
  if (action === "run_routine") {
    const taskId = (input as Record<string, unknown>).taskId;
    if (typeof taskId !== "string") throw new Error("invalid_pm_action");
    return { action, taskId };
  }

  throw new Error("unknown_pm_action");
}

export async function GET() {
  if (isSupabaseConfigured()) {
    try {
      const state = await getSupabasePmState();
      return Response.json({
        ok: true,
        demoMode: demoModeEnabled(),
        state
      });
    } catch (error) {
      console.error("GET pm state error:", error);
    }
  }
  return Response.json({
    ok: true,
    demoMode: demoModeEnabled(),
    state: workspaceState
  });
}

export async function POST(request: Request) {
  try {
    const actorId = requireHumanActor(request);
    const action = validateAction(await request.json());
    const occurredAt = nextTimestamp();

    if (isSupabaseConfigured()) {
      const state = await applySupabasePmAction(action, actorId, occurredAt);
      return Response.json({
        ok: true,
        demoMode: demoModeEnabled(),
        actorId,
        state
      });
    }

    workspaceState = applyAction(workspaceState, action, actorId, occurredAt);

    return Response.json({
      ok: true,
      demoMode: demoModeEnabled(),
      actorId,
      state: workspaceState
    });
  } catch (error) {
    return errorResponse(error);
  }
}
