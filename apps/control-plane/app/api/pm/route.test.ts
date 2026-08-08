import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "./route";

describe("PM control route", () => {
  beforeEach(() => {
    process.env.CONTROL_PLANE_DEMO_MODE = "true";
  });

  it("returns a structured PM projection", async () => {
    const response = await GET();
    const data = await response.json() as { ok: boolean; state: { tasks: unknown[]; events: unknown[] } };

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.state.tasks.length).toBeGreaterThan(0);
    expect(data.state.events.length).toBeGreaterThan(0);
  });

  it("requires a human actor and turns approval into an event-driven state change", async () => {
    const denied = await POST(new Request("http://localhost/api/pm", { method: "POST", body: JSON.stringify({ action: "approval", approvalId: "approval:pinterest-budget", decision: "approve" }) }));
    expect(denied.status).toBe(400);

    const response = await POST(new Request("http://localhost/api/pm", { method: "POST", headers: { "content-type": "application/json", "x-human-actor-id": "human:test" }, body: JSON.stringify({ action: "approval", approvalId: "approval:pinterest-budget", decision: "approve" }) }));
    const data = await response.json() as { ok: boolean; state: { tasks: Array<{ id: string; state: string }>; approvals: Array<{ id: string; status: string }>; events: Array<{ type: string; actorId: string }> } };
    const task = data.state.tasks.find((item) => item.id === "task:pinterest-test");
    const approval = data.state.approvals.find((item) => item.id === "approval:pinterest-budget");

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(task?.state).toBe("ready");
    expect(approval?.status).toBe("approved");
    expect(data.state.events[0]).toMatchObject({ type: "approval.approved", actorId: "human:test" });
  });
});
