import type { HumanRequestRecord, PmEvent, PmPriority, PmTask, PmTaskState } from "@agent-foundry/domain";

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

const scope = { organizationId: "org:agent-foundry", businessUnitId: "bu:commerce-lab" };

type PmTaskSeed = Omit<PmTaskView, "organizationId" | "businessUnitId"> & { businessUnitId?: string };

function task(input: PmTaskSeed): PmTaskView {
  return { ...scope, ...input, businessUnitId: input.businessUnitId ?? scope.businessUnitId };
}

function event(id: string, type: PmEvent["type"], objectType: PmEvent["objectType"], objectId: string, payload: Record<string, unknown>, occurredAt: string): PmEvent {
  return { ...scope, id, type, actorId: "agent:system", objectType, objectId, payload, occurredAt, idempotencyKey: id };
}

const now = "2026-08-07T14:32:00.000Z";

export function createInitialPmState(): PmWorkspaceState {
  const tasks: PmTaskView[] = [
    task({ id: "task:launch-wedge", shortId: "AF-142", title: "Validate the launch wedge for the first revenue engine", objectiveId: "objective:revenue-engine", state: "review", priority: "urgent", requestedBy: "human:andy", assignedAgentId: "agent:venture-strategist", reviewerId: "human:andy", workflowId: "workflow:wedge-research", costCenter: "growth-lab", progressPercent: 82, createdAt: "2026-08-05T10:00:00.000Z", updatedAt: now, area: "Strategy", businessName: "Commerce Lab", ownerName: "Venture Strategist", ownerInitials: "VS", ownerTone: "violet", tags: ["decision", "revenue"], checklist: [{ label: "Market scan", done: true }, { label: "Offer shortlist", done: true }, { label: "CEO review", done: false }] }),
    task({ id: "task:pinterest-test", shortId: "AF-138", title: "Run the Pinterest demand test", objectiveId: "objective:pinterest-test", state: "waiting_on_human", priority: "high", requestedBy: "agent:cro", assignedAgentId: "agent:cro", reviewerId: "human:andy", workflowId: "workflow:pinterest-test", costCenter: "growth-lab", progressPercent: 56, createdAt: "2026-08-04T08:00:00.000Z", updatedAt: "2026-08-07T12:10:00.000Z", area: "Growth", businessName: "Commerce Lab", ownerName: "CRO Agent", ownerInitials: "CR", ownerTone: "blue", tags: ["experiment", "paid media"], checklist: [{ label: "Audience and creative", done: true }, { label: "Budget approval", done: false }, { label: "Launch and measure", done: false }] }),
    task({ id: "task:cost-anomaly", shortId: "AF-136", title: "Investigate the model-cost anomaly", objectiveId: "objective:cost-control", state: "blocked", priority: "high", requestedBy: "agent:cfo", assignedAgentId: "agent:cost-controller", workflowId: "workflow:cost-anomaly", costCenter: "platform", blockedReason: "OpenRouter usage is 2.4× the seven-day baseline; waiting on provider breakdown.", progressPercent: 38, createdAt: "2026-08-03T15:00:00.000Z", updatedAt: "2026-08-07T11:42:00.000Z", area: "Finance", businessName: "Platform", ownerName: "Cost Controller", ownerInitials: "CC", ownerTone: "orange", tags: ["anomaly", "finance"], checklist: [{ label: "Isolate provider", done: true }, { label: "Compare task classes", done: false }, { label: "Recommend guardrail", done: false }] }),
    task({ id: "task:filing", shortId: "AF-131", title: "Prepare ARTJ LLC formation and tax checklist", objectiveId: "objective:filing", state: "waiting_on_human", priority: "high", requestedBy: "agent:ceo-filing-research", assignedAgentId: "agent:ceo-filing-research", reviewerId: "human:andy", workflowId: "workflow:filing-question", costCenter: "company", progressPercent: 74, createdAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-07T09:30:00.000Z", area: "Governance", businessName: "Company", ownerName: "CEO Research", ownerInitials: "CE", ownerTone: "teal", tags: ["legal", "human-only"], checklist: [{ label: "Research sources", done: true }, { label: "Draft checklist", done: true }, { label: "Confirm organizer details", done: false }] }),
    task({ id: "task:funnel", shortId: "AF-127", title: "Instrument the acquisition funnel", objectiveId: "objective:acquisition", state: "in_progress", priority: "medium", requestedBy: "agent:cro", assignedAgentId: "agent:analytics", workflowId: "workflow:funnel-instrumentation", costCenter: "growth-lab", progressPercent: 61, createdAt: "2026-07-30T09:00:00.000Z", updatedAt: "2026-08-07T13:18:00.000Z", area: "Growth", businessName: "Commerce Lab", ownerName: "Analytics Agent", ownerInitials: "AN", ownerTone: "green", tags: ["analytics", "funnel"], checklist: [{ label: "Define events", done: true }, { label: "Ship instrumentation", done: true }, { label: "Validate attribution", done: false }] }),
    task({ id: "task:landing-page", shortId: "AF-124", title: "Publish the first product landing page", objectiveId: "objective:launch", state: "waiting_on_agent", priority: "medium", requestedBy: "agent:venture-strategist", assignedAgentId: "agent:builder", workflowId: "workflow:landing-page", costCenter: "growth-lab", progressPercent: 68, createdAt: "2026-07-29T14:00:00.000Z", updatedAt: "2026-08-07T12:55:00.000Z", area: "Build", businessName: "Commerce Lab", ownerName: "Builder Agent", ownerInitials: "BU", ownerTone: "indigo", tags: ["asset", "deploy"], checklist: [{ label: "Copy review", done: true }, { label: "Build page", done: true }, { label: "Deploy shadow", done: false }] }),
    task({ id: "task:integration-health", shortId: "AF-119", title: "Reconnect analytics integration", objectiveId: "objective:observability", state: "ready", priority: "low", requestedBy: "agent:operator", assignedAgentId: "agent:operator", workflowId: "workflow:integration-health", costCenter: "platform", progressPercent: 12, createdAt: "2026-07-28T10:00:00.000Z", updatedAt: "2026-08-07T08:20:00.000Z", area: "Operations", businessName: "Platform", ownerName: "Ops Operator", ownerInitials: "OP", ownerTone: "slate", tags: ["integration"], checklist: [{ label: "Confirm scope", done: false }, { label: "Reconnect sandbox", done: false }] }),
    task({ id: "task:quality-loop", shortId: "AF-113", title: "Close the quality feedback loop for research outputs", objectiveId: "objective:quality", state: "complete", priority: "medium", requestedBy: "human:andy", assignedAgentId: "agent:evaluator", workflowId: "workflow:quality-loop", costCenter: "platform", progressPercent: 100, createdAt: "2026-07-25T11:00:00.000Z", updatedAt: "2026-08-06T17:00:00.000Z", area: "Quality", businessName: "Platform", ownerName: "Evaluator Agent", ownerInitials: "EV", ownerTone: "pink", tags: ["evaluation", "automation"], checklist: [{ label: "Define rubric", done: true }, { label: "Score outputs", done: true }, { label: "Auto-route failures", done: true }] })
  ];

  const approvals: ApprovalView[] = [
    { id: "approval:pinterest-budget", title: "Approve the Pinterest demand test", requester: "CRO Agent", requesterInitials: "CR", businessName: "Commerce Lab", workflowId: "workflow:pinterest-test", action: "Reserve $450 for a 7-day demand test", reasoning: "The offer shortlist has a 3.1× expected contribution margin at the current conversion range. A small paid test will resolve the highest-value uncertainty.", evidence: ["Offer shortlist scored 82/100", "Organic pin saves are up 38% week over week", "Spend is below the Growth Lab test threshold"], costMinor: 45000, risk: "medium", expectedOutcome: "Validate 100 qualified visits and at least 3 purchase-intent events.", alternatives: ["Run an organic-only test (slower, lower cost)", "Pause until the landing page is deployed"], recommendation: "approve", blocked: true, status: "pending", taskId: "task:pinterest-test" },
    { id: "approval:production-deploy", title: "Enable a production deploy for the landing page", requester: "Builder Agent", requesterInitials: "BU", businessName: "Commerce Lab", workflowId: "workflow:landing-page", action: "Enable the production deployment tool for one release", reasoning: "The landing page is complete in shadow mode and has passed the content and link checks. Production publishing is an external write and needs explicit human authorization.", evidence: ["Content review passed", "No secrets included in build", "Rollback target is available"], costMinor: 0, risk: "high", expectedOutcome: "Make the validated landing page available to the first acquisition test.", alternatives: ["Keep the page in shadow mode", "Publish manually after a human review"], recommendation: "review", blocked: true, status: "pending", taskId: "task:landing-page" },
    { id: "approval:agent-promotion", title: "Promote the cost controller to active", requester: "Platform Lead", requesterInitials: "PL", businessName: "Platform", workflowId: "workflow:agent-promotion", action: "Promote cost-controller from shadow to active", reasoning: "The agent has completed 24 shadow evaluations with 94% recommendation agreement and no policy violations.", evidence: ["24 shadow evaluations", "94% recommendation agreement", "Zero policy violations"], costMinor: 0, risk: "low", expectedOutcome: "Allow anomaly triage to run automatically within the existing read-only scope.", alternatives: ["Keep in shadow for another 10 evaluations"], recommendation: "approve", blocked: false, status: "pending", taskId: "task:cost-anomaly" }
  ];

  const humanRequests: HumanRequestView[] = [
    { ...scope, id: "human:organizer-details", workflowId: "workflow:filing-question", taskId: "task:filing", requestType: "missing_information", title: "Confirm the organizer details for the LLC checklist", exactAction: "Confirm the organizer name and Erie County municipality that should appear in the formation draft.", continuation: "The filing research workflow will resume, update the checklist, and keep all submission and payment actions disabled.", status: "open", requiredRole: "CEO", createdAt: "2026-08-07T09:30:00.000Z", requester: "CEO Research", requesterInitials: "CE", businessName: "Company" },
    { ...scope, id: "human:stripe-identity", workflowId: "workflow:payments", taskId: "task:pinterest-test", requestType: "identity_verification", title: "Verify the payment account identity", exactAction: "Open the Stripe verification page and complete the identity check. Do not share credentials in this workspace.", continuation: "The payment setup workflow will resume and report whether the account can accept test payments.", status: "open", requiredRole: "CEO", createdAt: "2026-08-06T16:40:00.000Z", requester: "Payments Operator", requesterInitials: "PO", businessName: "Commerce Lab" }
  ];

  const events: PmEvent[] = [
    event("event:1", "workflow.resumed", "workflow", "workflow:funnel-instrumentation", { summary: "Analytics agent resumed after a successful schema check." }, "2026-08-07T14:18:00.000Z"),
    event("event:2", "approval.requested", "approval", "approval:pinterest-budget", { summary: "CRO Agent requested a $450 test reservation.", taskId: "task:pinterest-test" }, "2026-08-07T12:10:00.000Z"),
    event("event:3", "task.blocked", "task", "task:cost-anomaly", { summary: "Provider-level usage breakdown is missing." }, "2026-08-07T11:42:00.000Z"),
    event("event:4", "human_request.created", "human_request", "human:organizer-details", { summary: "Formation checklist needs one factual confirmation." }, "2026-08-07T09:30:00.000Z"),
    event("event:5", "agent.finished", "agent", "agent:evaluator", { summary: "Quality feedback loop shipped to shadow evaluation." }, "2026-08-06T17:00:00.000Z")
  ];

  return {
    tasks,
    approvals,
    humanRequests,
    events,
    portfolios: [
      { id: "bu:commerce-lab", name: "Commerce Lab", stage: "validation", status: "watch", owner: "Venture Strategist", ownerInitials: "VS", revenueMinor: 184000, costMinor: 92000, marginPercent: 50, budgetUsedPercent: 62, forecastMinor: 720000, objective: "Find and validate the first repeatable revenue loop.", recommendation: "investigate", kpis: [{ label: "Qualified visits", value: "486", trend: "up" }, { label: "Intent events", value: "14", trend: "up" }, { label: "CAC forecast", value: "$18", trend: "down" }] },
      { id: "bu:platform", name: "Platform", stage: "scaling", status: "healthy", owner: "Platform Lead", ownerInitials: "PL", revenueMinor: 0, costMinor: 126000, marginPercent: 0, budgetUsedPercent: 41, forecastMinor: 0, objective: "Reduce cost and increase autonomous operating capacity.", recommendation: "maintain", kpis: [{ label: "Autonomy rate", value: "86%", trend: "up" }, { label: "Cost / outcome", value: "$3.42", trend: "down" }, { label: "Open incidents", value: "1", trend: "flat" }] },
      { id: "bu:studio", name: "Studio Experiments", stage: "incubating", status: "attention", owner: "Research Director", ownerInitials: "RD", revenueMinor: 0, costMinor: 31000, marginPercent: 0, budgetUsedPercent: 78, forecastMinor: 210000, objective: "Compare small bets and graduate the strongest one.", recommendation: "pause", kpis: [{ label: "Experiments", value: "4", trend: "flat" }, { label: "Evidence score", value: "61/100", trend: "down" }, { label: "Days to decision", value: "9", trend: "up" }] }
    ],
    agents: [
      { id: "agent:venture-strategist", name: "Venture Strategist", role: "Executive agent", team: "Executive Office", status: "active", workload: 72, quality: 91, costMinor: 18200, escalations: 2, initials: "VS", tone: "violet" },
      { id: "agent:cro", name: "CRO Agent", role: "Growth lead", team: "Commerce Lab", status: "active", workload: 84, quality: 88, costMinor: 14300, escalations: 3, initials: "CR", tone: "blue" },
      { id: "agent:cost-controller", name: "Cost Controller", role: "Finance control", team: "Platform", status: "awaiting_review", workload: 43, quality: 94, costMinor: 7800, escalations: 1, initials: "CC", tone: "orange" },
      { id: "agent:builder", name: "Builder Agent", role: "Product delivery", team: "Commerce Lab", status: "active", workload: 66, quality: 89, costMinor: 21500, escalations: 2, initials: "BU", tone: "indigo" }
    ],
    workflows: [
      { id: "workflow:pinterest-test", name: "Demand test workflow", objective: "Validate the first acquisition channel", currentStep: "Human budget approval", state: "waiting", agent: "CRO Agent", elapsed: "2h 18m", costMinor: 12600, progress: 56, steps: [{ label: "Brief", state: "done" }, { label: "Creative", state: "done" }, { label: "Budget", state: "current" }, { label: "Launch", state: "pending" }, { label: "Review", state: "pending" }] },
      { id: "workflow:funnel-instrumentation", name: "Funnel instrumentation", objective: "Make acquisition outcomes measurable", currentStep: "Validate attribution", state: "running", agent: "Analytics Agent", elapsed: "5h 42m", costMinor: 8400, progress: 61, steps: [{ label: "Schema", state: "done" }, { label: "Events", state: "done" }, { label: "Attribution", state: "current" }, { label: "Report", state: "pending" }] },
      { id: "workflow:cost-anomaly", name: "Cost anomaly review", objective: "Explain the OpenRouter spend spike", currentStep: "Provider breakdown", state: "failed", agent: "Cost Controller", elapsed: "1d 4h", costMinor: 21900, progress: 38, steps: [{ label: "Detect", state: "done" }, { label: "Classify", state: "done" }, { label: "Provider breakdown", state: "error" }, { label: "Guardrail", state: "pending" }] }
    ],
    generatedAt: now
  };
}

export type PmAction =
  | { action: "task_status"; taskId: string; state: PmTaskState }
  | { action: "task_priority"; taskId: string; priority: PmPriority }
  | { action: "add_note"; taskId: string; note: string }
  | { action: "approval"; approvalId: string; decision: "approve" | "reject" | "request_changes" | "defer" }
  | { action: "human_request"; requestId: string; decision: "complete" | "cancel" }
  | { action: "run_routine"; taskId: string };
