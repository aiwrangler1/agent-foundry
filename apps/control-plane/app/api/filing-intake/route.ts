import { createInMemoryFilingQuestionPersistence } from "@agent-foundry/db";
import { ARTJ_LLC_PROFILE } from "@agent-foundry/domain";
import type { AuthoritativeFilingSource, AuthoritativeTaxSource, HarnessAgent, ModelRouter } from "@agent-foundry/integrations";
import { answerFilingQuestion } from "@agent-foundry/workflows";

type FilingCitation = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  note: string;
};

type FilingEvidence = {
  label: string;
  value: string;
  source: string;
};

type FilingRun = {
  id: string;
  taskLabel: string;
  workflowState: string;
  intakeState: string;
  question: string;
  statusDetail: string;
  evidence: FilingEvidence[];
  citations: FilingCitation[];
  draftChecklist: string[];
  escalationReason: string;
  approval: {
    state: string;
    owner: string;
    nextStep: string;
  };
  updatedAt: string;
  mode: string;
  taxReview?: {
    status: string;
    cpaEscalationRequired: boolean;
    facts: string[];
    unresolvedQuestions: string[];
  };
};

function actor(request: Request) {
  if (process.env.CONTROL_PLANE_DEMO_MODE !== "true") {
    throw new Error("authenticated_human_adapter_required");
  }

  return {
    id: request.headers.get("x-human-actor-id") ?? "human:andy",
    role: "CEO" as const
  };
}

function defaultRun(question?: string): FilingRun {
  return {
    id: "shadow-filing-run-001",
    taskLabel: "ARTJ LLC filing and tax research preview",
    workflowState: "awaiting_human_review",
    intakeState: "read_only_preview_ready",
    question: question ?? "What do we need to prepare before forming ARTJ LLC in New York, including publication, tax registration, and human review?",
    statusDetail: "ARTJ LLC formation and tax research preview completed in shadow mode. Drafting is available; filing submission, registration, and payment remain disabled.",
    evidence: [
      { label: "Legal container", value: `${ARTJ_LLC_PROFILE.legalName} is the planned ${ARTJ_LLC_PROFILE.jurisdiction} ${ARTJ_LLC_PROFILE.structure} behind banking, EIN, taxes, contracts, and payment processors.`, source: "ARTJ LLC legal-entity profile" },
      { label: "Public naming", value: "Etsy storefronts and standalone websites may use their own names; a persistent business name may require an assumed-name filing under ARTJ LLC.", source: "New York assumed-name review" },
      { label: "Authority boundary", value: "No registered production-write tool is attached to this preview workflow.", source: "Control-plane policy gate" },
      { label: "Output posture", value: "Research, checklist drafting, and escalation only.", source: "Read-only filing capability contract" }
    ],
    citations: [
      {
        id: "ny-dos-articles-organization",
        title: "Articles of Organization for Domestic Limited Liability Company",
        publisher: "New York Department of State",
        url: "https://dos.ny.gov/node/35506",
        note: "Primary source for New York LLC formation, $200 filing fee, operating-agreement timing, and publication requirement."
      },
      {
        id: "ny-dos-assumed-name",
        title: "Certificate of Assumed Name",
        publisher: "New York Department of State",
        url: "https://dos.ny.gov/node/16151",
        note: "Primary source to confirm when ARTJ LLC must register a persistent storefront or business name; current listed LLC filing fee is $25 before any applicable county fee."
      },
      {
        id: "irs-single-member-llc",
        title: "Single member limited liability companies",
        publisher: "Internal Revenue Service",
        url: "https://www.irs.gov/businesses/small-businesses-self-employed/single-member-limited-liability-companies",
        note: "Primary source for default federal tax classification."
      },
      {
        id: "sba-recordkeeping",
        title: "Manage your business records",
        publisher: "U.S. Small Business Administration",
        url: "https://www.sba.gov/business-guide/manage-your-business/manage-your-business-records",
        note: "Helpful secondary source for document preparation and retention posture."
      }
    ],
    draftChecklist: [
      "Confirm ARTJ LLC name availability and clear the name for trademark risk before committing to it.",
      "Prepare New York Articles of Organization using Erie County, a lawful-business purpose, and the actual organizer information.",
      "Sign a single-member Operating Agreement and assign platform IP to ARTJ LLC.",
      "Complete New York publication using the two newspapers designated for the LLC's Erie County municipality.",
      "Obtain the EIN, open separate banking, and document owner contributions or loans.",
      "Classify each Etsy, website, software, or service offering for sales tax before the first taxable sale.",
      "Escalate legal interpretations, tax treatment, assumed-name filings, and final filing approval to a human reviewer and qualified professional."
    ],
    escalationReason: "ARTJ LLC formation, assumed-name, tax, and payment decisions can create legal or financial commitments. This workflow stops at research and drafting so a human approver, attorney, and CPA can review the result.",
    approval: {
      state: "human_review_required",
      owner: "Founder or delegated company officer",
    nextStep: "Review the cited checklist, confirm ARTJ LLC facts, and involve New York counsel or a CPA before any real filing, registration, payment, or assumed-name decision."
    },
    updatedAt: "August 6, 2026",
    mode: "shadow / read-only",
    ...(ARTJ_LLC_PROFILE.status === "planned" ? { taxReview: { status: "CPA review required", cpaEscalationRequired: true, facts: [ARTJ_LLC_PROFILE.brandPolicy], unresolvedQuestions: ["Confirm formation status, assumed-name obligations, and tax registration needs before operating publicly."] } } : {})
  };
}

const persistence = createInMemoryFilingQuestionPersistence();
const sourceFixtures: AuthoritativeFilingSource[] = [
  {
    id: "source:ny:articles-organization",
    title: "Articles of Organization for Domestic Limited Liability Company",
    publisher: "New York Department of State",
    documentType: "government guidance",
    url: "https://dos.ny.gov/node/35506",
    retrievedAt: "2026-08-06T00:00:00.000Z",
    snippet: "New York explains how to form a domestic limited liability company and identifies the Articles of Organization filing fee.",
    facts: ["New York forms a domestic LLC by filing Articles of Organization with the Department of State.", "The New York Articles of Organization filing fee is $200."],
    confidence: 0.95
  },
  {
    id: "source:ny:publication",
    title: "Certificate of Publication for Domestic Limited Liability Company",
    publisher: "New York Department of State",
    documentType: "government guidance",
    url: "https://dos.ny.gov/certificate-publication-domestic-limited-liability-company-0",
    retrievedAt: "2026-08-06T00:00:00.000Z",
    snippet: "New York requires most domestic LLCs to publish a formation notice in two designated newspapers and file a Certificate of Publication.",
    facts: ["The LLC publication requirement uses two newspapers designated by the county clerk for the county where the LLC office is located."],
    confidence: 0.95
  }
];

const authoritativeSources = {
  async retrieve() {
    return sourceFixtures.map((source) => ({ ...source, retrievedAt: new Date().toISOString() }));
  }
};

const taxSourceFixtures: AuthoritativeTaxSource[] = [
  {
    id: "source:ny-tax:sales-tax-registration",
    title: "Do I Need to Register for Sales Tax?",
    publisher: "New York State Department of Taxation and Finance",
    jurisdiction: "New York",
    sourceType: "tax bulletin",
    url: "https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/do_i_need_to_register_for_sales_tax.htm",
    retrievedAt: "2026-08-06T00:00:00.000Z",
    snippet: "New York explains when a vendor must obtain a Certificate of Authority before making taxable sales.",
    facts: [
      "A vendor generally must obtain a New York Certificate of Authority before making taxable sales.",
      "Services are generally exempt unless a specific taxable service rule applies."
    ],
    confidence: 0.95
  },
  {
    id: "source:irs:single-member-llc-tax",
    title: "Single Member Limited Liability Companies",
    publisher: "Internal Revenue Service",
    jurisdiction: "United States",
    sourceType: "IRS guidance",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/single-member-limited-liability-companies",
    retrievedAt: "2026-08-06T00:00:00.000Z",
    snippet: "The IRS describes the default federal income-tax classification of a single-member LLC.",
    facts: ["A single-member LLC is generally disregarded for federal income tax unless it elects corporate treatment."],
    confidence: 0.95
  }
];

const authoritativeTaxSources = {
  async retrieve() {
    return taxSourceFixtures.map((source) => ({ ...source, retrievedAt: new Date().toISOString() }));
  }
};

const modelRouter: ModelRouter = {
  async select(input) {
    const tax = input.taskClass.includes("tax");
    const stronger = input.taskClass.includes("stronger");
    return { model: tax ? (stronger ? "qualified-stronger-tax-research" : "qualified-inexpensive-tax-research") : (stronger ? "qualified-stronger-filing-research" : "qualified-inexpensive-filing-research"), qualified: true, estimatedCostMinor: stronger ? 25 : 5 };
  }
};

const harnessAgent: HarnessAgent = {
  name: "ai-sdk-harness-agent",
  experimental: true,
  nativeToolFiltering: true,
  nativeApprovalRequests: true,
  async invoke() {
    return {
      output: "The retrieved government guidance supports preparing the entity identifiers, filing period, registered-agent details, and tax calculations for human review. This is a draft research checklist, not legal or tax advice.",
      proposedGatewayActions: [],
      model: "qualified-filing-research-model",
      costMinor: 7
    };
  }
};

const taxHarnessAgent: HarnessAgent = {
  name: "ai-sdk-harness-agent",
  experimental: true,
  nativeToolFiltering: true,
  nativeApprovalRequests: true,
  async invoke() {
    return {
      output: "The tax reviewer identified sales-tax registration, taxable-service classification, and federal entity-tax treatment as questions requiring confirmation. This is cited research, not legal or tax advice; do not register, file, pay, remit, or make an election from this workflow.",
      proposedGatewayActions: [],
      model: "qualified-tax-research-model",
      costMinor: 7
    };
  }
};

function runtime(now: () => Date) {
  return {
    authoritativeSources,
    modelRouter,
    harnessAgent,
    persistence,
    taxReviewer: {
      authoritativeSources: authoritativeTaxSources,
      modelRouter,
      harnessAgent: taxHarnessAgent,
      jurisdictions: ["United States", "New York", "Erie County, New York"],
      entityType: `${ARTJ_LLC_PROFILE.legalName}, proposed ${ARTJ_LLC_PROFILE.jurisdiction} ${ARTJ_LLC_PROFILE.structure}`,
      businessActivities: ["shared software/control-plane ownership, Etsy storefronts, and product websites; exact taxable offerings unresolved"],
      maxCostMinor: 50
    },
    overheadCost: { modelInput: 0, modelOutput: 0, cachedInput: 0, apiUnits: 1, toolExecution: 0, retries: 0, failedWork: 0, reviewerWork: 0, managementCalls: 0, storage: 0, humanAttention: 0, currency: "USD" },
    now
  };
}

function runFromResult(result: Awaited<ReturnType<typeof answerFilingQuestion>>): FilingRun {
  return {
    id: result.route.workflowId,
    taskLabel: "ARTJ LLC filing and tax research",
    workflowState: "awaiting_human_review",
    intakeState: "read_only_shadow_completed",
    question: result.intake.question,
    statusDetail: `Authoritative sources were retrieved before model use. ${result.answer.modelOutput}`,
    evidence: [
      ...result.answer.facts.map((fact) => ({ label: "Cited fact", value: fact, source: "Authoritative filing research workflow" })),
      ...(result.taxReview?.facts.map((fact) => ({ label: "Tax fact", value: fact, source: "Shadow tax research reviewer" })) ?? [])
    ],
    citations: [
      ...result.answer.citations.map((citation) => ({ id: citation.sourceId, title: citation.title, publisher: citation.publisher, url: citation.url, note: `${citation.documentType}; retrieved ${citation.retrievedAt}.` })),
      ...(result.taxReview?.citations.map((citation) => ({ id: citation.sourceId, title: citation.title, publisher: citation.publisher, url: citation.url, note: `${citation.sourceType}; ${citation.jurisdiction}; retrieved ${citation.retrievedAt}.` })) ?? [])
    ],
    draftChecklist: ["Confirm entity name, file number, filing period, and registered-agent details.", "Verify filing deadlines and tax calculations with qualified professionals.", ...result.answer.unresolvedQuestions, ...(result.taxReview?.unresolvedQuestions ?? []), ...(result.taxReview ? ["Ask a CPA whether the proposed products or services require New York sales-tax registration; do not register until confirmed."] : []), "Keep this output as research/drafting only; a human must approve any real filing decision."],
    escalationReason: `Legal and tax filing decisions remain human-only. The workflow produced research and a draft checklist without submission, payment, signature, or permission tools.${result.taxReview ? " CPA confirmation is required before any tax registration, filing, payment, remittance, or election." : ""}`,
    approval: { state: "human_review_required", owner: "Founder or delegated company officer", nextStep: "Review facts and citations, then involve counsel or a tax professional where required." },
    updatedAt: new Date().toISOString(),
    mode: "shadow / read-only",
    ...(result.taxReview ? { taxReview: { status: "CPA review required", cpaEscalationRequired: result.taxReview.cpaEscalation.required, facts: result.taxReview.facts, unresolvedQuestions: result.taxReview.unresolvedQuestions } } : {})
  };
}

let latestRun = defaultRun();

function response(run: FilingRun) {
  return Response.json({
    ok: true,
    demoMode: process.env.CONTROL_PLANE_DEMO_MODE === "true",
    authenticated: process.env.CONTROL_PLANE_DEMO_MODE === "true",
    readOnly: true,
    productionWritesEnabled: false,
    run
  });
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "filing_intake_failed";
  const status = message === "authenticated_human_adapter_required" ? 503 : 400;
  return Response.json({ ok: false, error: message, demoMode: process.env.CONTROL_PLANE_DEMO_MODE === "true", authenticated: false, readOnly: true, productionWritesEnabled: false, run: latestRun }, { status });
}

export function GET() {
  return response(latestRun);
}

export async function POST(request: Request) {
  try {
    actor(request);
    const body = await request.json() as { question?: string };
    const question = String(body.question ?? "").trim();
    const result = await answerFilingQuestion({
      organizationId: "org:agent-foundry",
      businessUnitId: "bu:company",
      taskId: `task:filing-question:${Date.now()}`,
      question,
      actorId: actor(request).id,
      actorRole: "CEO",
      capability: "filing-research",
      maxInitialCostMinor: 10,
      maxEscalationCostMinor: 50
    }, runtime(() => new Date()));
    latestRun = runFromResult(result);
    return response(latestRun);
  } catch (error) {
    return errorResponse(error);
  }
}
