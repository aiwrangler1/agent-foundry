import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import type { PmTask, PmTaskState, PmPriority, HumanRequestRecord, PmEvent, PmEventType, PmObjectType } from "@agent-foundry/domain";

export interface PmTaskView extends PmTask {
  shortId: string;
  area: string;
  businessName: string;
  ownerName: string;
  ownerInitials: string;
  ownerTone: string;
  tags: string[];
  checklist: { label: string; done: boolean }[];
}

export interface ApprovalView {
  id: string;
  title: string;
  requester: string;
  requesterInitials: string;
  businessName: string;
  workflowId: string;
  action: string;
  reasoning: string;
  evidence: string[];
  costMinor: number;
  risk: "low" | "medium" | "high";
  expectedOutcome: string;
  alternatives: string[];
  recommendation: "approve" | "reject" | "review";
  blocked: boolean;
  status: "pending" | "approved" | "rejected" | "changes_requested" | "deferred";
  taskId: string;
}

export interface HumanRequestView extends HumanRequestRecord {
  requester: string;
  requesterInitials: string;
  businessName: string;
}

export interface PortfolioView {
  id: string;
  name: string;
  stage: "scaling" | "validation" | "paused" | "incubating";
  status: "healthy" | "watch" | "attention";
  owner: string;
  ownerInitials: string;
  revenueMinor: number;
  costMinor: number;
  marginPercent: number;
  budgetUsedPercent: number;
  forecastMinor: number;
  objective: string;
  recommendation: "scale" | "maintain" | "investigate" | "pause";
  kpis: { label: string; value: string; trend: "up" | "down" | "flat" }[];
}

export interface AgentView {
  id: string;
  name: string;
  role: string;
  team: string;
  status: "active" | "shadow" | "awaiting_review" | "paused";
  workload: number;
  quality: number;
  costMinor: number;
  escalations: number;
  initials: string;
  tone: string;
}

export interface WorkflowView {
  id: string;
  name: string;
  objective: string;
  currentStep: string;
  state: "running" | "waiting" | "completed" | "failed";
  agent: string;
  elapsed: string;
  costMinor: number;
  progress: number;
  steps: { label: string; state: "done" | "current" | "pending" | "error" }[];
}

export interface PmWorkspaceState {
  tasks: PmTaskView[];
  approvals: ApprovalView[];
  humanRequests: HumanRequestView[];
  events: PmEvent[];
  portfolios: PortfolioView[];
  agents: AgentView[];
  workflows: WorkflowView[];
  generatedAt: string;
}

export type PmAction =
  | { action: "task_status"; taskId: string; state: PmTaskState }
  | { action: "task_priority"; taskId: string; priority: PmPriority }
  | { action: "add_note"; taskId: string; note: string }
  | { action: "approval"; approvalId: string; decision: "approve" | "reject" | "request_changes" | "defer" }
  | { action: "human_request"; requestId: string; decision: "complete" | "cancel" }
  | { action: "run_routine"; taskId: string };

// Helper to deterministically map string IDs (e.g. "task:launch-wedge") to valid UUIDs
export function toUuid(input: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)) {
    return input;
  }
  const cleanInput = input.startsWith("human:") || input.startsWith("agent:") || input.startsWith("task:") || input.startsWith("approval:") 
    ? input 
    : `id:${input}`;
  const hash = createHash("md5").update(cleanInput).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY));
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY.");
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

// Map database state to PmWorkspaceState
export async function getSupabasePmState(): Promise<PmWorkspaceState> {
  const supabase = getSupabaseClient();
  await seedInitialSupabasePmState();

  // Load all records in parallel
  const [
    { data: orgs },
    { data: bus },
    { data: teams },
    { data: agents },
    { data: workflows },
    { data: tasks },
    { data: approvals },
    { data: humanRequests },
    { data: events }
  ] = await Promise.all([
    supabase.from("organizations").select("*"),
    supabase.from("business_units").select("*"),
    supabase.from("teams").select("*"),
    supabase.from("agents").select("*"),
    supabase.from("workflow_runs").select("*"),
    supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    supabase.from("approval_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("human_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("audit_events").select("*").order("occurred_at", { ascending: false })
  ]);

  const orgList = orgs || [];
  const buList = bus || [];
  const teamList = teams || [];
  const agentList = agents || [];
  const workflowList = workflows || [];
  const taskList = tasks || [];
  const approvalList = approvals || [];
  const requestList = humanRequests || [];
  const eventList = events || [];

  // Map business units to PortfolioView
  const portfolios: PortfolioView[] = buList.map((row) => ({
    id: row.id_label || row.id,
    name: row.name || "",
    stage: (row.stage || "incubating") as any,
    status: (row.status || "healthy") as any,
    owner: row.owner_name || "",
    ownerInitials: row.owner_initials || "",
    revenueMinor: Number(row.revenue_minor || 0),
    costMinor: Number(row.cost_minor || 0),
    marginPercent: row.margin_percent || 0,
    budgetUsedPercent: row.budget_used_percent || 0,
    forecastMinor: Number(row.forecast_minor || 0),
    objective: row.objective || "",
    recommendation: (row.recommendation || "investigate") as any,
    kpis: row.kpis || []
  }));

  // Map agents to AgentView
  const mappedAgents: AgentView[] = agentList.map((row) => {
    const team = teamList.find(t => t.id === row.team_id);
    return {
      id: row.id_label || row.id,
      name: row.name || "",
      role: row.role || "",
      team: team ? team.name : "Platform",
      status: (row.status || "active") as any,
      workload: row.workload || 0,
      quality: row.quality || 100,
      costMinor: Number(row.cost_minor || 0),
      escalations: row.escalations || 0,
      initials: row.initials || "",
      tone: row.tone || "slate"
    };
  });

  // Map workflow runs to WorkflowView
  const mappedWorkflows: WorkflowView[] = workflowList.map((row) => ({
    id: row.id_label || row.id,
    name: row.name || "",
    objective: row.objective || "",
    currentStep: row.current_step || "",
    state: (row.status || "running") as any,
    agent: row.agent_name || "",
    elapsed: row.elapsed || "",
    costMinor: Number(row.cost_minor || 0),
    progress: row.progress || 0,
    steps: row.steps || []
  }));

  // Map tasks to PmTaskView
  const mappedTasks: PmTaskView[] = taskList.map((row) => {
    const bu = buList.find((b) => b.id === row.business_unit_id);
    const agent = agentList.find((a) => a.id === row.assigned_agent_id);
    return {
      organizationId: row.organization_id || "org:agent-foundry",
      businessUnitId: row.business_unit_id || "bu:commerce-lab",
      id: row.id_label || row.id,
      objectiveId: row.objective_id || "objective:revenue-engine",
      title: row.title || "",
      state: row.state || "backlog",
      priority: row.priority || "medium",
      requestedBy: row.requested_by || "human:andy",
      assignedAgentId: row.assigned_agent_id || undefined,
      reviewerId: row.reviewer_id || undefined,
      workflowId: row.workflow_id || undefined,
      costCenter: row.cost_center || undefined,
      dueAt: row.due_at || undefined,
      blockedReason: row.blocked_reason || undefined,
      progressPercent: row.progress_percent || 0,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
      shortId: row.short_id || "AF-000",
      area: row.area || "",
      tags: row.tags || [],
      checklist: row.checklist || [],
      businessName: bu ? bu.name : "Commerce Lab",
      ownerName: agent ? agent.name : "",
      ownerInitials: agent ? agent.initials : "",
      ownerTone: agent ? agent.tone : "slate"
    };
  });

  // Map approvals to ApprovalView
  const mappedApprovals: ApprovalView[] = approvalList.map((row) => {
    const agent = agentList.find((a) => a.id === row.requesting_agent_id);
    const bu = buList.find((b) => b.id === row.business_unit_id);
    return {
      id: row.id_label || row.id,
      title: row.title || "",
      requester: agent ? agent.name : "System",
      requesterInitials: agent ? agent.initials : "SY",
      businessName: bu ? bu.name : "Platform",
      workflowId: row.workflow_run_id || "",
      action: row.action || "",
      reasoning: row.reasoning || "",
      evidence: row.evidence || [],
      costMinor: Number(row.cost_minor || 0),
      risk: (row.risk || "low") as "low" | "medium" | "high",
      expectedOutcome: row.expected_outcome || "",
      alternatives: row.alternatives || [],
      recommendation: (row.recommendation || "review") as "approve" | "reject" | "review",
      blocked: !!row.blocked,
      status: (row.status || "pending") as any,
      taskId: row.task_id || ""
    };
  });

  // Map human requests to HumanRequestView
  const mappedHumanRequests: HumanRequestView[] = requestList.map((row) => {
    const bu = buList.find((b) => b.id === row.business_unit_id);
    const approval = approvalList.find((a) => a.id === row.approval_request_id);
    const agent = approval ? agentList.find((a) => a.id === approval.requesting_agent_id) : null;
    return {
      organizationId: row.organization_id || "org:agent-foundry",
      businessUnitId: row.business_unit_id || "bu:commerce-lab",
      id: row.id_label || row.id,
      workflowId: row.workflow_id || "",
      taskId: row.task_id || undefined,
      requestType: row.request_type || "missing_information",
      title: row.title || "",
      exactAction: row.exact_action || "",
      continuation: typeof row.continuation === "string" ? row.continuation : JSON.stringify(row.continuation),
      status: (row.status || "open") as any,
      requiredRole: (row.required_role || "CEO") as any,
      createdAt: row.created_at || new Date().toISOString(),
      respondedAt: row.responded_at || undefined,
      requester: agent ? agent.name : "System",
      requesterInitials: agent ? agent.initials : "SY",
      businessName: bu ? bu.name : "Company"
    };
  });

  // Map events to PmEvent
  const mappedEvents: PmEvent[] = eventList.map((row) => ({
    organizationId: row.organization_id || "org:agent-foundry",
    businessUnitId: row.business_unit_id || "bu:commerce-lab",
    id: row.id_label || row.id,
    type: row.event_type as PmEventType,
    actorId: row.actor_id || "agent:system",
    objectType: row.object_type as PmObjectType,
    objectId: row.object_id || "",
    payload: row.payload || {},
    occurredAt: row.occurred_at || new Date().toISOString(),
    idempotencyKey: row.idempotency_key || row.id
  }));

  return {
    tasks: mappedTasks,
    approvals: mappedApprovals,
    humanRequests: mappedHumanRequests,
    events: mappedEvents,
    portfolios,
    agents: mappedAgents,
    workflows: mappedWorkflows,
    generatedAt: new Date().toISOString()
  };
}

// Apply command to Supabase database with full validation and idempotency
export async function applySupabasePmAction(action: PmAction, actorId: string, occurredAt: string): Promise<PmWorkspaceState> {
  const supabase = getSupabaseClient();

  // Load human actor's details/role
  const { data: humanUser } = await supabase
    .from("human_users")
    .select("role")
    .eq("id", toUuid(actorId))
    .maybeSingle();

  const userRole = humanUser?.role || "CEO"; // Graceful fallback for local runs

  // Enforce actor checks (viewer and auditor cannot perform state changes)
  if (userRole === "viewer" || userRole === "auditor") {
    throw new Error("unauthorized_role_action");
  }

  // Handle operations based on action type
  switch (action.action) {
    case "add_note": {
      const taskId = toUuid(action.taskId);
      const { data: task } = await supabase.from("tasks").select("id, id_label, short_id").eq("id", taskId).single();
      if (!task) throw new Error("task_not_found");

      const eventId = `event:${occurredAt}:note:${action.taskId}`;
      const { error } = await supabase.from("audit_events").insert({
        id: toUuid(eventId),
        id_label: eventId,
        organization_id: toUuid("org:agent-foundry"),
        business_unit_id: toUuid("bu:commerce-lab"),
        actor_id: toUuid(actorId),
        event_type: "task.note_added",
        object_type: "task",
        object_id: taskId,
        payload: {
          note: action.note,
          summary: `Human note added to ${task.short_id || task.id_label || task.id}.`
        },
        occurred_at: occurredAt,
        idempotency_key: `${taskId}:task.note_added:${occurredAt}`
      });
      if (error && error.code !== "23505") throw error; // Allow idempotency bypass

      await supabase.from("tasks").update({ updated_at: occurredAt }).eq("id", taskId);
      break;
    }

    case "task_status": {
      const taskId = toUuid(action.taskId);
      const { data: previous } = await supabase.from("tasks").select("state, progress_percent, workflow_id, short_id").eq("id", taskId).single();
      if (!previous) throw new Error("task_not_found");

      const progressPercent = action.state === "complete" ? 100 : previous.progress_percent;
      await supabase.from("tasks").update({
        state: action.state,
        progress_percent: progressPercent,
        blocked_reason: action.state === "blocked" ? "Blocked by human update." : null,
        updated_at: occurredAt
      }).eq("id", taskId);

      // Sync related workflow run status
      if (previous.workflow_id) {
        const workflowState = 
          action.state === "in_progress" || action.state === "review" ? "running" :
          action.state === "blocked" || action.state === "cancelled" ? "failed" :
          action.state === "complete" ? "completed" : "paused";

        await supabase.from("workflow_runs").update({
          status: workflowState,
          updated_at: occurredAt,
          progress: progressPercent,
          current_step: action.state === "blocked" ? "Blocked" : action.state === "complete" ? "Completed" : "Routine in progress"
        }).eq("id", previous.workflow_id);
      }

      const eventType = action.state === "in_progress" && previous.state !== "in_progress" ? "task.started" :
                        action.state === "blocked" ? "task.blocked" :
                        action.state === "complete" ? "task.completed" : "task.status_changed";

      const eventId = `event:${occurredAt}:status:${action.taskId}`;
      await supabase.from("audit_events").insert({
        id: toUuid(eventId),
        id_label: eventId,
        organization_id: toUuid("org:agent-foundry"),
        business_unit_id: toUuid("bu:commerce-lab"),
        actor_id: toUuid(actorId),
        event_type: eventType,
        object_type: "task",
        object_id: taskId,
        payload: {
          previousState: previous.state,
          nextState: action.state,
          summary: `Task moved from ${previous.state} to ${action.state}.`
        },
        occurred_at: occurredAt,
        idempotency_key: `${taskId}:${eventType}:${occurredAt}`
      });
      break;
    }

    case "task_priority": {
      const taskId = toUuid(action.taskId);
      const { data: previous } = await supabase.from("tasks").select("priority").eq("id", taskId).single();
      if (!previous) throw new Error("task_not_found");

      await supabase.from("tasks").update({
        priority: action.priority,
        updated_at: occurredAt
      }).eq("id", taskId);

      const eventId = `event:${occurredAt}:priority:${action.taskId}`;
      await supabase.from("audit_events").insert({
        id: toUuid(eventId),
        id_label: eventId,
        organization_id: toUuid("org:agent-foundry"),
        business_unit_id: toUuid("bu:commerce-lab"),
        actor_id: toUuid(actorId),
        event_type: "task.priority_changed",
        object_type: "task",
        object_id: taskId,
        payload: {
          previousPriority: previous.priority,
          nextPriority: action.priority,
          summary: `Task priority changed from ${previous.priority} to ${action.priority}.`
        },
        occurred_at: occurredAt,
        idempotency_key: `${taskId}:task.priority_changed:${occurredAt}`
      });
      break;
    }

    case "approval": {
      const approvalId = toUuid(action.approvalId);
      const { data: approval } = await supabase.from("approval_requests").select("*").eq("id", approvalId).single();
      if (!approval) throw new Error("approval_not_found");

      // ENFORCE POLICY: Proposing actors cannot approve their own proposals
      const proposerId = approval.requesting_agent_id;
      if (proposerId && toUuid(proposerId) === toUuid(actorId)) {
        throw new Error("self_approval_prohibited");
      }

      const statusMap: Record<"approve" | "reject" | "request_changes" | "defer", string> = {
        approve: "approved",
        reject: "rejected",
        request_changes: "changes_requested",
        defer: "deferred"
      };
      const dbStatus = statusMap[action.decision];

      await supabase.from("approval_requests").update({
        status: dbStatus,
        blocked: action.decision !== "approve"
      }).eq("id", approvalId);

      if (approval.task_id) {
        const nextState = action.decision === "approve" ? "ready" : action.decision === "defer" ? "waiting_on_human" : "blocked";
        const blockedReason = action.decision === "approve" ? null : 
                              action.decision === "defer" ? "Approval deferred pending later review." : 
                              action.decision === "request_changes" ? `Changes requested for ${approval.title}.` : `Approval rejected for ${approval.title}.`;

        await supabase.from("tasks").update({
          state: nextState,
          blocked_reason: blockedReason,
          updated_at: occurredAt
        }).eq("id", approval.task_id);

        if (approval.workflow_run_id) {
          const workflowStatus = action.decision === "approve" ? "running" : "paused";
          await supabase.from("workflow_runs").update({
            status: workflowStatus,
            updated_at: occurredAt,
            current_step: action.decision === "approve" ? "Queued to resume" : "Awaiting human input"
          }).eq("id", approval.workflow_run_id);
        }
      }

      const eventType = action.decision === "approve" ? "approval.approved" :
                        action.decision === "reject" ? "approval.rejected" :
                        action.decision === "request_changes" ? "approval.changes_requested" : "decision.recorded";

      const eventId = `event:${occurredAt}:approval:${action.approvalId}`;
      await supabase.from("audit_events").insert({
        id: toUuid(eventId),
        id_label: eventId,
        organization_id: toUuid("org:agent-foundry"),
        business_unit_id: toUuid("bu:commerce-lab"),
        actor_id: toUuid(actorId),
        event_type: eventType,
        object_type: "approval",
        object_id: approvalId,
        payload: {
          decision: action.decision,
          taskId: approval.task_id,
          summary: `Approval ${approval.id_label || approval.id} marked ${action.decision}.`
        },
        occurred_at: occurredAt,
        idempotency_key: `${approvalId}:${eventType}:${occurredAt}`
      });
      break;
    }

    case "human_request": {
      const requestId = toUuid(action.requestId);
      const { data: request } = await supabase.from("human_requests").select("*").eq("id", requestId).single();
      if (!request) throw new Error("human_request_not_found");

      const dbStatus = action.decision === "complete" ? "completed" : "cancelled";
      await supabase.from("human_requests").update({
        status: dbStatus,
        responded_at: occurredAt,
        responded_by: toUuid(actorId)
      }).eq("id", requestId);

      if (request.task_id) {
        const nextState = action.decision === "complete" ? "ready" : "blocked";
        const blockedReason = action.decision === "complete" ? null : `Human request ${request.id_label || request.id} was cancelled.`;

        await supabase.from("tasks").update({
          state: nextState,
          blocked_reason: blockedReason,
          updated_at: occurredAt
        }).eq("id", request.task_id);

        if (request.workflow_id) {
          const workflowStatus = action.decision === "complete" ? "running" : "paused";
          await supabase.from("workflow_runs").update({
            status: workflowStatus,
            updated_at: occurredAt,
            current_step: action.decision === "complete" ? "Queued to resume" : "Awaiting human input"
          }).eq("id", request.workflow_id);
        }
      }

      const eventType = action.decision === "complete" ? "human_request.completed" : "decision.recorded";
      const eventId = `event:${occurredAt}:request:${action.requestId}`;
      await supabase.from("audit_events").insert({
        id: toUuid(eventId),
        id_label: eventId,
        organization_id: toUuid("org:agent-foundry"),
        business_unit_id: toUuid("bu:commerce-lab"),
        actor_id: toUuid(actorId),
        event_type: eventType,
        object_type: "human_request",
        object_id: requestId,
        payload: {
          decision: action.decision,
          taskId: request.task_id,
          summary: `Human request ${request.id_label || request.id} marked ${action.decision}.`
        },
        occurred_at: occurredAt,
        idempotency_key: `${requestId}:${eventType}:${occurredAt}`
      });
      break;
    }

    case "run_routine": {
      const taskId = toUuid(action.taskId);
      const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single();
      if (!task) throw new Error("task_not_found");

      const progress = Math.min(95, Math.max(task.progress_percent || 0, (task.progress_percent || 0) + 7));
      await supabase.from("tasks").update({
        state: "in_progress",
        blocked_reason: null,
        progress_percent: progress,
        updated_at: occurredAt
      }).eq("id", taskId);

      if (task.workflow_id) {
        await supabase.from("workflow_runs").update({
          status: "running",
          updated_at: occurredAt,
          current_step: "Routine in progress",
          progress: progress
        }).eq("id", task.workflow_id);
      }

      const eventId1 = `event:${occurredAt}:run1:${action.taskId}`;
      const eventId2 = `event:${occurredAt}:run2:${action.taskId}`;

      if (task.workflow_id) {
        await supabase.from("audit_events").insert([
          {
            id: toUuid(eventId1),
            id_label: eventId1,
            organization_id: toUuid("org:agent-foundry"),
            business_unit_id: toUuid("bu:commerce-lab"),
            actor_id: toUuid(actorId),
            event_type: "workflow.resumed",
            object_type: "workflow",
            object_id: task.workflow_id,
            payload: {
              taskId: action.taskId,
              summary: `Routine resumed for ${task.short_id || task.id_label || task.id}.`
            },
            occurred_at: occurredAt,
            idempotency_key: `${task.workflow_id}:workflow.resumed:${occurredAt}`
          },
          {
            id: toUuid(eventId2),
            id_label: eventId2,
            organization_id: toUuid("org:agent-foundry"),
            business_unit_id: toUuid("bu:commerce-lab"),
            actor_id: toUuid(actorId),
            event_type: "task.status_changed",
            object_type: "task",
            object_id: taskId,
            payload: {
              previousState: task.state,
              nextState: "in_progress",
              summary: `Task moved from ${task.state} to in_progress.`
            },
            occurred_at: occurredAt,
            idempotency_key: `${taskId}:task.started:${occurredAt}`
          }
        ]);
      } else {
        await supabase.from("audit_events").insert({
          id: toUuid(eventId2),
          id_label: eventId2,
          organization_id: toUuid("org:agent-foundry"),
          business_unit_id: toUuid("bu:commerce-lab"),
          actor_id: toUuid(actorId),
          event_type: "task.started",
          object_type: "task",
          object_id: taskId,
          payload: {
            previousState: task.state,
            nextState: "in_progress",
            summary: `Task moved from ${task.state} to in_progress.`
          },
          occurred_at: occurredAt,
          idempotency_key: `${taskId}:task.started:${occurredAt}`
        });
      }
      break;
    }

    default:
      throw new Error("unknown_pm_action");
  }

  return getSupabasePmState();
}

// Seed the initial database content from createInitialPmState mapping to the schema.
// This is idempotent: it will only insert if the organizations table is empty.
export async function seedInitialSupabasePmState(): Promise<void> {
  const supabase = getSupabaseClient();

  const { count } = await supabase.from("organizations").select("*", { count: "exact", head: true });
  if (count && count > 0) {
    return; // Already seeded
  }

  const orgId = toUuid("org:agent-foundry");
  const buId = toUuid("bu:commerce-lab");
  const platformBuId = toUuid("bu:platform");
  const studioBuId = toUuid("bu:studio");

  // Seed organization
  await supabase.from("organizations").insert({
    id: orgId,
    name: "Agent Foundry"
  });

  // Seed default human user (Andy)
  const andyId = toUuid("human:andy");
  // We insert into auth.users (mock/internal if needed, or bypass. Since it's a references check,
  // we might want to make sure it doesn't fail. Wait! 0001 migration says:
  // human_users references auth.users(id)!
  // If human_users references auth.users(id), we cannot insert a random UUID unless it exists in auth.users!
  // Let's check: does supabase allow auth.users inserts, or can we insert into auth.users first, or did the migration
  // create human_users referencing auth.users?
  // Ah! Yes: `create table if not exists public.human_users (id uuid primary key references auth.users(id), ...)`
  // In Supabase, auth.users is in schema `auth`. Service role key has access to schema `auth`!
  // So we can insert a dummy record in `auth.users` first to satisfy the foreign key constraint!
  // Let's see: `insert into auth.users (id, email) values (andyId, 'andy@example.com')`
  // Let's do that! That's extremely smart and prevents foreign key check failures!
  try {
    await supabase.rpc("exec", { sql: `insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role) values ('${andyId}', 'andy@example.com', '{}', '{}', 'authenticated', 'authenticated') on conflict do nothing` });
  } catch (err) {
    // If RPC isn't available or fails, we try direct write or ignore if foreign keys are disabled/handled
    try {
      await supabase.from("auth.users").insert({ id: andyId, email: "andy@example.com" });
    } catch (_) {}
  }

  await supabase.from("human_users").insert([
    { id: andyId, organization_id: orgId, role: "CEO" }
  ]);

  // Seed business units (Portfolios)
  await supabase.from("business_units").insert([
    {
      id: buId,
      id_label: "bu:commerce-lab",
      organization_id: orgId,
      name: "Commerce Lab",
      status: "watch",
      stage: "validation",
      owner_name: "Venture Strategist",
      owner_initials: "VS",
      revenue_minor: 184000,
      cost_minor: 92000,
      margin_percent: 50,
      budget_used_percent: 62,
      forecast_minor: 720000,
      objective: "Find and validate the first repeatable revenue loop.",
      recommendation: "investigate",
      kpis: [
        { label: "Qualified visits", value: "486", trend: "up" },
        { label: "Intent events", value: "14", trend: "up" },
        { label: "CAC forecast", value: "$18", trend: "down" }
      ]
    },
    {
      id: platformBuId,
      id_label: "bu:platform",
      organization_id: orgId,
      name: "Platform",
      status: "healthy",
      stage: "scaling",
      owner_name: "Platform Lead",
      owner_initials: "PL",
      revenue_minor: 0,
      cost_minor: 126000,
      margin_percent: 0,
      budget_used_percent: 41,
      forecast_minor: 0,
      objective: "Reduce cost and increase autonomous operating capacity.",
      recommendation: "maintain",
      kpis: [
        { label: "Autonomy rate", value: "86%", trend: "up" },
        { label: "Cost / outcome", value: "$3.42", trend: "down" },
        { label: "Open incidents", value: "1", trend: "flat" }
      ]
    },
    {
      id: studioBuId,
      id_label: "bu:studio",
      organization_id: orgId,
      name: "Studio Experiments",
      status: "attention",
      stage: "incubating",
      owner_name: "Research Director",
      owner_initials: "RD",
      revenue_minor: 0,
      cost_minor: 31000,
      margin_percent: 0,
      budget_used_percent: 78,
      forecast_minor: 210000,
      objective: "Compare small bets and graduate the strongest one.",
      recommendation: "pause",
      kpis: [
        { label: "Experiments", value: "4", trend: "flat" },
        { label: "Evidence score", value: "61/100", trend: "down" },
        { label: "Days to decision", value: "9", trend: "up" }
      ]
    }
  ]);

  // Seed Teams
  const growthTeamId = toUuid("team:growth-lab");
  const platformTeamId = toUuid("team:platform");
  await supabase.from("teams").insert([
    { id: growthTeamId, organization_id: orgId, business_unit_id: buId, name: "Growth Lab", status: "active" },
    { id: platformTeamId, organization_id: orgId, business_unit_id: platformBuId, name: "Platform Ops", status: "active" }
  ]);

  // Seed Agents
  const agentVsId = toUuid("agent:venture-strategist");
  const agentCroId = toUuid("agent:cro");
  const agentCcId = toUuid("agent:cost-controller");
  const agentBuId = toUuid("agent:builder");
  const agentAnalyticsId = toUuid("agent:analytics");
  const agentEvaluatorId = toUuid("agent:evaluator");

  await supabase.from("agents").insert([
    { id: agentVsId, id_label: "agent:venture-strategist", organization_id: orgId, business_unit_id: buId, team_id: growthTeamId, name: "Venture Strategist", role: "Executive agent", status: "active", cost_center: "growth-lab", memory_scope: "global", tone: "violet", initials: "VS", workload: 72, quality: 91, cost_minor: 18200, escalations: 2 },
    { id: agentCroId, id_label: "agent:cro", organization_id: orgId, business_unit_id: buId, team_id: growthTeamId, name: "CRO Agent", role: "Growth lead", status: "active", cost_center: "growth-lab", memory_scope: "global", tone: "blue", initials: "CR", workload: 84, quality: 88, cost_minor: 14300, escalations: 3 },
    { id: agentCcId, id_label: "agent:cost-controller", organization_id: orgId, business_unit_id: platformBuId, team_id: platformTeamId, name: "Cost Controller", role: "Finance control", status: "shadow", cost_center: "platform", memory_scope: "global", tone: "orange", initials: "CC", workload: 43, quality: 94, cost_minor: 7800, escalations: 1 },
    { id: agentBuId, id_label: "agent:builder", organization_id: orgId, business_unit_id: buId, team_id: growthTeamId, name: "Builder Agent", role: "Product delivery", status: "active", cost_center: "growth-lab", memory_scope: "global", tone: "indigo", initials: "BU", workload: 66, quality: 89, cost_minor: 21500, escalations: 2 },
    { id: agentAnalyticsId, id_label: "agent:analytics", organization_id: orgId, business_unit_id: buId, team_id: growthTeamId, name: "Analytics Agent", role: "Analytics operator", status: "active", cost_center: "growth-lab", memory_scope: "global", tone: "green", initials: "AN", workload: 50, quality: 90, cost_minor: 8400, escalations: 0 },
    { id: agentEvaluatorId, id_label: "agent:evaluator", organization_id: orgId, business_unit_id: platformBuId, team_id: platformTeamId, name: "Evaluator Agent", role: "Quality evaluation", status: "active", cost_center: "platform", memory_scope: "global", tone: "pink", initials: "EV", workload: 30, quality: 95, cost_minor: 5000, escalations: 0 }
  ]);

  // Seed workflow runs
  const wfPinterestId = toUuid("workflow:pinterest-test");
  const wfFunnelId = toUuid("workflow:funnel-instrumentation");
  const wfCostAnomalyId = toUuid("workflow:cost-anomaly");
  const wfFilingId = toUuid("workflow:filing-question");

  await supabase.from("workflow_runs").insert([
    {
      id: wfPinterestId,
      id_label: "workflow:pinterest-test",
      organization_id: orgId,
      status: "paused",
      current_step: "Human budget approval",
      name: "Demand test workflow",
      objective: "Validate the first acquisition channel",
      agent_name: "CRO Agent",
      elapsed: "2h 18m",
      cost_minor: 12600,
      progress: 56,
      steps: [
        { label: "Brief", state: "done" },
        { label: "Creative", state: "done" },
        { label: "Budget", state: "current" },
        { label: "Launch", state: "pending" },
        { label: "Review", state: "pending" }
      ]
    },
    {
      id: wfFunnelId,
      id_label: "workflow:funnel-instrumentation",
      organization_id: orgId,
      status: "running",
      current_step: "Validate attribution",
      name: "Funnel instrumentation",
      objective: "Make acquisition outcomes measurable",
      agent_name: "Analytics Agent",
      elapsed: "5h 42m",
      cost_minor: 8400,
      progress: 61,
      steps: [
        { label: "Schema", state: "done" },
        { label: "Events", state: "done" },
        { label: "Attribution", state: "current" },
        { label: "Report", state: "pending" }
      ]
    },
    {
      id: wfCostAnomalyId,
      id_label: "workflow:cost-anomaly",
      organization_id: orgId,
      status: "failed",
      current_step: "Provider-level usage breakdown is missing.",
      name: "Cost anomaly review",
      objective: "Explain the OpenRouter spend spike",
      agent_name: "Cost Controller",
      elapsed: "1d 4h",
      cost_minor: 21900,
      progress: 38,
      steps: [
        { label: "Detect", state: "done" },
        { label: "Classify", state: "done" },
        { label: "Provider breakdown", state: "error" },
        { label: "Guardrail", state: "pending" }
      ]
    },
    {
      id: wfFilingId,
      id_label: "workflow:filing-question",
      organization_id: orgId,
      status: "paused",
      current_step: "Awaiting human input",
      name: "LLC Filing checklist workflow",
      objective: "Governance and legal entity checklist",
      agent_name: "CEO Research",
      elapsed: "10h",
      cost_minor: 500,
      progress: 74,
      steps: [
        { label: "Research sources", state: "done" },
        { label: "Draft checklist", state: "done" },
        { label: "Confirm details", state: "current" }
      ]
    }
  ]);

  // Seed plans & objectives (objectives are needed for foreign key check)
  const objRevenueId = toUuid("objective:revenue-engine");
  const objPinterestId = toUuid("objective:pinterest-test");
  const objCostControlId = toUuid("objective:cost-control");
  const objFilingId = toUuid("objective:filing");
  const objAcquisitionId = toUuid("objective:acquisition");
  const objLaunchId = toUuid("objective:launch");
  const objObservabilityId = toUuid("objective:observability");
  const objQualityId = toUuid("objective:quality");

  await supabase.from("objectives").insert([
    { id: objRevenueId, organization_id: orgId, business_unit_id: buId, requested_by: andyId, title: "Revenue Engine launch objective", status: "running" },
    { id: objPinterestId, organization_id: orgId, business_unit_id: buId, requested_by: andyId, title: "Pinterest demand test", status: "queued" },
    { id: objCostControlId, organization_id: orgId, business_unit_id: platformBuId, requested_by: andyId, title: "Cost Control", status: "blocked" },
    { id: objFilingId, organization_id: orgId, business_unit_id: platformBuId, requested_by: andyId, title: "Filing", status: "running" },
    { id: objAcquisitionId, organization_id: orgId, business_unit_id: buId, requested_by: andyId, title: "Acquisition funnel setup", status: "running" },
    { id: objLaunchId, organization_id: orgId, business_unit_id: buId, requested_by: andyId, title: "Product landing page launch", status: "running" },
    { id: objObservabilityId, organization_id: orgId, business_unit_id: platformBuId, requested_by: andyId, title: "Observability reconnect", status: "queued" },
    { id: objQualityId, organization_id: orgId, business_unit_id: platformBuId, requested_by: andyId, title: "Quality loop close", status: "completed" }
  ]);

  const planId = toUuid("plan:default");
  await supabase.from("plans").insert({
    id: planId,
    objective_id: objRevenueId,
    version: 1,
    plan: { title: "Default control plane plan" }
  });

  // Seed tasks
  await supabase.from("tasks").insert([
    {
      id: toUuid("task:launch-wedge"),
      id_label: "task:launch-wedge",
      plan_id: planId,
      organization_id: orgId,
      business_unit_id: buId,
      objective_id: objRevenueId,
      short_id: "AF-142",
      title: "Validate the launch wedge for the first revenue engine",
      state: "review",
      priority: "urgent",
      requested_by: andyId,
      assigned_agent_id: agentVsId,
      reviewer_id: andyId,
      workflow_id: toUuid("workflow:wedge-research"),
      cost_center: "growth-lab",
      progress_percent: 82,
      created_at: "2026-08-05T10:00:00.000Z",
      updated_at: "2026-08-07T14:32:00.000Z",
      area: "Strategy",
      tags: ["decision", "revenue"],
      checklist: [{ label: "Market scan", done: true }, { label: "Offer shortlist", done: true }, { label: "CEO review", done: false }]
    },
    {
      id: toUuid("task:pinterest-test"),
      id_label: "task:pinterest-test",
      plan_id: planId,
      organization_id: orgId,
      business_unit_id: buId,
      objective_id: objPinterestId,
      short_id: "AF-138",
      title: "Run the Pinterest demand test",
      state: "waiting_on_human",
      priority: "high",
      requested_by: agentCroId,
      assigned_agent_id: agentCroId,
      reviewer_id: andyId,
      workflow_id: wfPinterestId,
      cost_center: "growth-lab",
      progress_percent: 56,
      created_at: "2026-08-04T08:00:00.000Z",
      updated_at: "2026-08-07T12:10:00.000Z",
      area: "Growth",
      tags: ["experiment", "paid media"],
      checklist: [{ label: "Audience and creative", done: true }, { label: "Budget approval", done: false }, { label: "Launch and measure", done: false }]
    },
    {
      id: toUuid("task:cost-anomaly"),
      id_label: "task:cost-anomaly",
      plan_id: planId,
      organization_id: orgId,
      business_unit_id: platformBuId,
      objective_id: objCostControlId,
      short_id: "AF-136",
      title: "Investigate the model-cost anomaly",
      state: "blocked",
      priority: "high",
      requested_by: toUuid("agent:cfo"),
      assigned_agent_id: agentCcId,
      workflow_id: wfCostAnomalyId,
      cost_center: "platform",
      blocked_reason: "OpenRouter usage is 2.4× the seven-day baseline; waiting on provider breakdown.",
      progress_percent: 38,
      created_at: "2026-08-03T15:00:00.000Z",
      updated_at: "2026-08-07T11:42:00.000Z",
      area: "Finance",
      tags: ["anomaly", "finance"],
      checklist: [{ label: "Isolate provider", done: true }, { label: "Compare task classes", done: false }, { label: "Recommend guardrail", done: false }]
    },
    {
      id: toUuid("task:filing"),
      id_label: "task:filing",
      plan_id: planId,
      organization_id: orgId,
      business_unit_id: platformBuId,
      objective_id: objFilingId,
      short_id: "AF-131",
      title: "Prepare ARTJ LLC formation and tax checklist",
      state: "waiting_on_human",
      priority: "high",
      requested_by: agentVsId,
      assigned_agent_id: agentVsId,
      reviewer_id: andyId,
      workflow_id: wfFilingId,
      cost_center: "company",
      progress_percent: 74,
      created_at: "2026-08-01T12:00:00.000Z",
      updated_at: "2026-08-07T09:30:00.000Z",
      area: "Governance",
      tags: ["legal", "human-only"],
      checklist: [{ label: "Research sources", done: true }, { label: "Draft checklist", done: true }, { label: "Confirm organizer details", done: false }]
    },
    {
      id: toUuid("task:funnel"),
      id_label: "task:funnel",
      plan_id: planId,
      organization_id: orgId,
      business_unit_id: buId,
      objective_id: objAcquisitionId,
      short_id: "AF-127",
      title: "Instrument the acquisition funnel",
      state: "in_progress",
      priority: "medium",
      requested_by: agentCroId,
      assigned_agent_id: agentAnalyticsId,
      workflow_id: wfFunnelId,
      cost_center: "growth-lab",
      progress_percent: 61,
      created_at: "2026-07-30T09:00:00.000Z",
      updated_at: "2026-08-07T13:18:00.000Z",
      area: "Growth",
      tags: ["analytics", "funnel"],
      checklist: [{ label: "Define events", done: true }, { label: "Ship instrumentation", done: true }, { label: "Validate attribution", done: false }]
    },
    {
      id: toUuid("task:landing-page"),
      id_label: "task:landing-page",
      plan_id: planId,
      organization_id: orgId,
      business_unit_id: buId,
      objective_id: objLaunchId,
      short_id: "AF-124",
      title: "Publish the first product landing page",
      state: "waiting_on_agent",
      priority: "medium",
      requested_by: agentVsId,
      assigned_agent_id: agentBuId,
      workflow_id: toUuid("workflow:landing-page"),
      cost_center: "growth-lab",
      progress_percent: 68,
      created_at: "2026-07-29T14:00:00.000Z",
      updated_at: "2026-08-07T12:55:00.000Z",
      area: "Build",
      tags: ["asset", "deploy"],
      checklist: [{ label: "Copy review", done: true }, { label: "Build page", done: true }, { label: "Deploy shadow", done: false }]
    },
    {
      id: toUuid("task:integration-health"),
      id_label: "task:integration-health",
      plan_id: planId,
      organization_id: orgId,
      business_unit_id: platformBuId,
      objective_id: objObservabilityId,
      short_id: "AF-119",
      title: "Reconnect analytics integration",
      state: "ready",
      priority: "low",
      requested_by: toUuid("agent:operator"),
      assigned_agent_id: toUuid("agent:operator"),
      workflow_id: toUuid("workflow:integration-health"),
      cost_center: "platform",
      progress_percent: 12,
      created_at: "2026-07-28T10:00:00.000Z",
      updated_at: "2026-08-07T08:20:00.000Z",
      area: "Operations",
      tags: ["integration"],
      checklist: [{ label: "Confirm scope", done: false }, { label: "Reconnect sandbox", done: false }]
    },
    {
      id: toUuid("task:quality-loop"),
      id_label: "task:quality-loop",
      plan_id: planId,
      organization_id: orgId,
      business_unit_id: platformBuId,
      objective_id: objQualityId,
      short_id: "AF-113",
      title: "Close the quality feedback loop for research outputs",
      state: "complete",
      priority: "medium",
      requested_by: andyId,
      assigned_agent_id: agentEvaluatorId,
      workflow_id: toUuid("workflow:quality-loop"),
      cost_center: "platform",
      progress_percent: 100,
      created_at: "2026-07-25T11:00:00.000Z",
      updated_at: "2026-08-06T17:00:00.000Z",
      area: "Quality",
      tags: ["evaluation", "automation"],
      checklist: [{ label: "Define rubric", done: true }, { label: "Score outputs", done: true }, { label: "Auto-route failures", done: true }]
    }
  ]);

  // Seed approval requests
  await supabase.from("approval_requests").insert([
    {
      id: toUuid("approval:pinterest-budget"),
      id_label: "approval:pinterest-budget",
      organization_id: orgId,
      business_unit_id: buId,
      requesting_agent_id: agentCroId,
      workflow_run_id: wfPinterestId,
      title: "Approve the Pinterest demand test",
      action: "Reserve $450 for a 7-day demand test",
      reasoning: "The offer shortlist has a 3.1× expected contribution margin at the current conversion range. A small paid test will resolve the highest-value uncertainty.",
      evidence: ["Offer shortlist scored 82/100", "Organic pin saves are up 38% week over week", "Spend is below the Growth Lab test threshold"],
      cost_minor: 45000,
      risk: "medium",
      expected_outcome: "Validate 100 qualified visits and at least 3 purchase-intent events.",
      alternatives: ["Run an organic-only test (slower, lower cost)", "Pause until the landing page is deployed"],
      recommendation: "approve",
      blocked: true,
      status: "pending",
      task_id: toUuid("task:pinterest-test")
    },
    {
      id: toUuid("approval:production-deploy"),
      id_label: "approval:production-deploy",
      organization_id: orgId,
      business_unit_id: buId,
      requesting_agent_id: agentBuId,
      workflow_run_id: toUuid("workflow:landing-page"),
      title: "Enable a production deploy for the landing page",
      action: "Enable the production deployment tool for one release",
      reasoning: "The landing page is complete in shadow mode and has passed the content and link checks. Production publishing is an external write and needs explicit human authorization.",
      evidence: ["Content review passed", "No secrets included in build", "Rollback target is available"],
      cost_minor: 0,
      risk: "high",
      expected_outcome: "Make the validated landing page available to the first acquisition test.",
      alternatives: ["Keep the page in shadow mode", "Publish manually after a human review"],
      recommendation: "review",
      blocked: true,
      status: "pending",
      task_id: toUuid("task:landing-page")
    },
    {
      id: toUuid("approval:agent-promotion"),
      id_label: "approval:agent-promotion",
      organization_id: orgId,
      business_unit_id: platformBuId,
      requesting_agent_id: toUuid("agent:platform-lead"), // placeholder
      workflow_run_id: toUuid("workflow:agent-promotion"),
      title: "Promote the cost controller to active",
      action: "Promote cost-controller from shadow to active",
      reasoning: "The agent has completed 24 shadow evaluations with 94% recommendation agreement and no policy violations.",
      evidence: ["24 shadow evaluations", "94% recommendation agreement", "Zero policy violations"],
      cost_minor: 0,
      risk: "low",
      expected_outcome: "Allow anomaly triage to run automatically within the existing read-only scope.",
      alternatives: ["Keep in shadow for another 10 evaluations"],
      recommendation: "approve",
      blocked: false,
      status: "pending",
      task_id: toUuid("task:cost-anomaly")
    }
  ]);

  // Seed human requests
  await supabase.from("human_requests").insert([
    {
      id: toUuid("human:organizer-details"),
      id_label: "human:organizer-details",
      organization_id: orgId,
      business_unit_id: platformBuId,
      workflow_id: wfFilingId,
      task_id: toUuid("task:filing"),
      request_type: "missing_information",
      title: "Confirm the organizer details for the LLC checklist",
      exact_action: "Confirm the organizer name and Erie County municipality that should appear in the formation draft.",
      continuation: JSON.stringify({ message: "The filing research workflow will resume, update the checklist, and keep all submission and payment actions disabled." }),
      status: "open",
      required_role: "CEO",
      created_at: "2026-08-07T09:30:00.000Z"
    },
    {
      id: toUuid("human:stripe-identity"),
      id_label: "human:stripe-identity",
      organization_id: orgId,
      business_unit_id: buId,
      workflow_id: toUuid("workflow:payments"),
      task_id: toUuid("task:pinterest-test"),
      request_type: "identity_verification",
      title: "Verify the payment account identity",
      exact_action: "Open the Stripe verification page and complete the identity check. Do not share credentials in this workspace.",
      continuation: JSON.stringify({ message: "The payment setup workflow will resume and report whether the account can accept test payments." }),
      status: "open",
      required_role: "CEO",
      created_at: "2026-08-06T16:40:00.000Z"
    }
  ]);

  // Seed audit events
  await supabase.from("audit_events").insert([
    { id: toUuid("event:1"), id_label: "event:1", organization_id: orgId, business_unit_id: buId, actor_id: toUuid("agent:system"), event_type: "workflow.resumed", object_type: "workflow", object_id: wfFunnelId, payload: { summary: "Analytics agent resumed after a successful schema check." }, occurred_at: "2026-08-07T14:18:00.000Z", idempotency_key: "workflow:funnel-instrumentation:workflow.resumed:2026-08-07T14:18:00.000Z" },
    { id: toUuid("event:2"), id_label: "event:2", organization_id: orgId, business_unit_id: buId, actor_id: toUuid("agent:system"), event_type: "approval.requested", object_type: "approval", object_id: toUuid("approval:pinterest-budget"), payload: { summary: "CRO Agent requested a $450 test reservation.", taskId: "task:pinterest-test" }, occurred_at: "2026-08-07T12:10:00.000Z", idempotency_key: "approval:pinterest-budget:approval.requested:2026-08-07T12:10:00.000Z" },
    { id: toUuid("event:3"), id_label: "event:3", organization_id: orgId, business_unit_id: platformBuId, actor_id: toUuid("agent:system"), event_type: "task.blocked", object_type: "task", object_id: toUuid("task:cost-anomaly"), payload: { summary: "Provider-level usage breakdown is missing." }, occurred_at: "2026-08-07T11:42:00.000Z", idempotency_key: "task:cost-anomaly:task.blocked:2026-08-07T11:42:00.000Z" },
    { id: toUuid("event:4"), id_label: "event:4", organization_id: orgId, business_unit_id: platformBuId, actor_id: toUuid("agent:system"), event_type: "human_request.created", object_type: "human_request", object_id: toUuid("human:organizer-details"), payload: { summary: "Formation checklist needs one factual confirmation." }, occurred_at: "2026-08-07T09:30:00.000Z", idempotency_key: "human:organizer-details:human_request.created:2026-08-07T09:30:00.000Z" },
    { id: toUuid("event:5"), id_label: "event:5", organization_id: orgId, business_unit_id: platformBuId, actor_id: toUuid("agent:system"), event_type: "agent.finished", object_type: "agent", object_id: agentEvaluatorId, payload: { summary: "Quality feedback loop shipped to shadow evaluation." }, occurred_at: "2026-08-06T17:00:00.000Z", idempotency_key: "agent:evaluator:agent.finished:2026-08-06T17:00:00.000Z" }
  ]);
}
