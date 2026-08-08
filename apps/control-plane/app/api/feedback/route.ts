import { activatePreference, confirmFeedback, InMemoryFeedbackRepository, proposePreference, rejectFeedback, submitFeedback } from "@agent-foundry/feedback";

const repository = new InMemoryFeedbackRepository();
const demoOrganizationId = "org:agent-foundry";

function actor(request: Request) {
  if (process.env.CONTROL_PLANE_DEMO_MODE !== "true") throw new Error("authenticated_human_adapter_required");
  return { id: request.headers.get("x-human-actor-id") ?? "human:andy", role: "CEO" as const };
}

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "feedback_request_failed";
  const status = message === "authenticated_human_adapter_required" ? 503 : 400;
  return Response.json({ ok: false, error: message }, { status });
}

export async function GET(request: Request) {
  try {
    actor(request);
    return Response.json({
      ok: true,
      demoMode: process.env.CONTROL_PLANE_DEMO_MODE === "true",
      feedback: await repository.listFeedback(demoOrganizationId),
      preferences: await repository.listPreferences(demoOrganizationId),
      events: await repository.listEvents(demoOrganizationId)
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const human = actor(request);
    const action = body.action;
    if (action === "submit") {
      const feedback = await submitFeedback(repository, {
        organizationId: demoOrganizationId,
        submittedByHumanId: human.id,
        source: "control_panel",
        category: (body.category ?? "preference") as "correction" | "preference" | "decision" | "explanation" | "policy_proposal",
        target: (body.target ?? "assistant_behavior") as "assistant_behavior" | "agent_behavior" | "human_team" | "procedure" | "policy",
        statement: String(body.statement ?? ""),
        context: String(body.context ?? ""),
        persistence: body.persistence === "one_time" ? "one_time" : "durable",
        provenance: "control-panel-human-feedback"
      });
      return Response.json({ ok: true, feedback });
    }
    const feedbackId = String(body.feedbackId ?? "");
    if (action === "confirm") return Response.json({ ok: true, feedback: await confirmFeedback(repository, feedbackId, human) });
    if (action === "reject") return Response.json({ ok: true, feedback: await rejectFeedback(repository, feedbackId, human, String(body.reason ?? "Rejected by human reviewer.")) });
    if (action === "confirm_and_activate") {
      const confirmed = await confirmFeedback(repository, feedbackId, human);
      const preference = await proposePreference(repository, confirmed.id, human, {
        key: String(body.key ?? ""),
        statement: confirmed.statement,
        rationale: String(body.rationale ?? "Human-confirmed preference."),
        appliesTo: (body.appliesTo ?? "codex") as "codex" | "agents" | "human_team" | "control_plane"
      });
      const active = preference.status === "proposed" ? await activatePreference(repository, preference.id, human) : preference;
      return Response.json({ ok: true, feedback: confirmed, preference: active });
    }
    throw new Error("unknown_feedback_action");
  } catch (error) {
    return errorResponse(error);
  }
}
