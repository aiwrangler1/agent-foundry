import { describe, expect, it } from "vitest";
import { InMemoryFeedbackRepository, activatePreference, compileRelevantPreferences, confirmFeedback, proposePreference, submitFeedback } from "./index";

const repository = () => new InMemoryFeedbackRepository();
const actor = { id: "human:founder", role: "CEO" as const };

async function confirmedFeedback(repo: InMemoryFeedbackRepository, overrides: Partial<Parameters<typeof submitFeedback>[1]> = {}) {
  const feedback = await submitFeedback(repo, {
    organizationId: "org:foundry",
    submittedByHumanId: actor.id,
    source: "control_panel",
    category: "preference",
    target: "assistant_behavior",
    statement: "Explain unfamiliar acronyms on first use.",
    context: "The founder is learning the control-plane vocabulary.",
    persistence: "durable",
    provenance: "founder feedback",
    ...overrides
  });
  return confirmFeedback(repo, feedback.id, actor);
}

describe("governed human feedback loop", () => {
  it("does not persist feedback as a preference before explicit confirmation", async () => {
    const repo = repository();
    const feedback = await submitFeedback(repo, {
      organizationId: "org:foundry", submittedByHumanId: actor.id, source: "codex_conversation", category: "preference",
      target: "assistant_behavior", statement: "Use plain language.", context: "Founder guidance.", persistence: "durable", provenance: "conversation:1"
    });
    expect(feedback.status).toBe("pending_confirmation");
    await expect(proposePreference(repo, feedback.id, actor, { key: "communication.plain_language", statement: "Use plain language.", rationale: "Reduce ambiguity.", appliesTo: "codex" })).rejects.toThrow("feedback_must_be_confirmed_first");
  });

  it("requires a second governed activation step and compiles only active preferences", async () => {
    const repo = repository();
    const feedback = await confirmedFeedback(repo);
    const proposed = await proposePreference(repo, feedback.id, actor, { key: "communication.explain_acronyms", statement: "Explain unfamiliar acronyms on first use.", rationale: "Improve human onboarding.", appliesTo: "codex" });
    expect(proposed.status).toBe("proposed");
    expect(await compileRelevantPreferences(repo, { organizationId: "org:foundry" }, "codex")).toHaveLength(0);
    await activatePreference(repo, proposed.id, actor);
    expect((await compileRelevantPreferences(repo, { organizationId: "org:foundry" }, "codex")).map((item) => item.key)).toEqual(["communication.explain_acronyms"]);
  });

  it("cannot let feedback change authority or policy automatically", async () => {
    const repo = repository();
    const feedback = await confirmedFeedback(repo, { category: "policy_proposal", target: "policy", statement: "Let agents bypass approvals for speed." });
    const proposed = await proposePreference(repo, feedback.id, actor, { key: "authority.bypass_approvals", statement: "Let agents bypass approvals for speed.", rationale: "Proposal to review only.", appliesTo: "control_plane" });
    expect(proposed.status).toBe("requires_policy_review");
    await expect(activatePreference(repo, proposed.id, actor)).rejects.toThrow("preference_not_ready_for_activation");
    expect(proposed.authorityEffect).toBe("none");
  });

  it("requires explicit supersession when replacing an active preference", async () => {
    const repo = repository();
    const firstFeedback = await confirmedFeedback(repo);
    const first = await proposePreference(repo, firstFeedback.id, actor, { key: "communication.explain_acronyms", statement: "Explain acronyms.", rationale: "Clarity.", appliesTo: "codex" });
    await activatePreference(repo, first.id, actor);
    const secondFeedback = await confirmedFeedback(repo, { statement: "Explain acronyms and unfamiliar terms.", context: "Refinement." });
    const second = await proposePreference(repo, secondFeedback.id, actor, { key: "communication.explain_acronyms", statement: "Explain acronyms and unfamiliar terms.", rationale: "Better onboarding.", appliesTo: "codex" });
    await expect(activatePreference(repo, second.id, actor)).rejects.toThrow("active_preference_conflict_requires_explicit_supersession");
    const replacementFeedback = await confirmedFeedback(repo, { statement: "Explain acronyms and unfamiliar terms.", context: "Approved refinement." });
    const replacement = await proposePreference(repo, replacementFeedback.id, actor, { key: "communication.explain_acronyms", statement: "Explain acronyms and unfamiliar terms.", rationale: "Better onboarding.", appliesTo: "codex", supersedesPreferenceId: first.id });
    await activatePreference(repo, replacement.id, actor);
    expect((await repo.getPreference(first.id))?.status).toBe("superseded");
  });
});
