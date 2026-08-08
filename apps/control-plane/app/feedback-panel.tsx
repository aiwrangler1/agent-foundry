"use client";

import { useEffect, useState } from "react";

type FeedbackItem = { id: string; statement: string; context: string; status: string; persistence: string; target: string; };
type PreferenceItem = { id: string; key: string; statement: string; status: string; appliesTo: string; };

export default function FeedbackPanel() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [preferences, setPreferences] = useState<PreferenceItem[]>([]);
  const [statement, setStatement] = useState("");
  const [context, setContext] = useState("");
  const [key, setKey] = useState("communication.explain_first_use");
  const [rationale, setRationale] = useState("Make the control plane easier for humans to operate.");
  const [persistence, setPersistence] = useState("durable");
  const [message, setMessage] = useState("");
  const [demoMode, setDemoMode] = useState(false);

  async function refresh() {
    const response = await fetch("/api/feedback");
    const data = await response.json() as { feedback?: FeedbackItem[]; preferences?: PreferenceItem[]; demoMode?: boolean };
    setFeedback(data.feedback ?? []);
    setPreferences(data.preferences ?? []);
    setDemoMode(data.demoMode === true);
  }

  useEffect(() => { void refresh(); }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "submit", statement, context, persistence }) });
    const data = await response.json() as { ok: boolean; error?: string };
    if (!data.ok) { setMessage(data.error ?? "Could not submit feedback."); return; }
    setStatement("");
    setContext("");
    setMessage("Feedback submitted and is waiting for your confirmation.");
    await refresh();
  }

  async function confirm(item: FeedbackItem) {
    const durable = item.persistence === "durable";
    const response = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(durable ? { action: "confirm_and_activate", feedbackId: item.id, key, rationale, appliesTo: "codex" } : { action: "confirm", feedbackId: item.id }) });
    const data = await response.json() as { ok: boolean; error?: string; preference?: PreferenceItem };
    setMessage(data.ok ? (data.preference?.status === "requires_policy_review" ? "Confirmed, but held for policy review." : "Confirmed and recorded.") : (data.error ?? "Could not confirm feedback."));
    await refresh();
  }

  return <section className="feedback-panel">
    <div className="panel-heading"><div><p className="muted">Human feedback loop</p><h2>Founder and team guidance</h2></div><span className={demoMode ? "status-pill warning" : "status-pill"}>{demoMode ? "Local demo mode" : "Auth required"}</span></div>
    <p className="muted">Feedback is proposed first. Nothing becomes durable context until a human confirms it. Feedback cannot grant authority, bypass approvals, or change policy automatically.</p>
    <form onSubmit={submit} className="feedback-form">
      <label>What should we do differently?<textarea value={statement} onChange={(event) => setStatement(event.target.value)} required placeholder="Example: Explain unfamiliar acronyms the first time they appear." /></label>
      <label>Why and when does this matter?<textarea value={context} onChange={(event) => setContext(event.target.value)} required placeholder="Example: I am learning the operating vocabulary and need more guidance early on." /></label>
      <label className="inline-control">Persistence<select value={persistence} onChange={(event) => setPersistence(event.target.value)}><option value="durable">Remember as a proposed preference</option><option value="one_time">Use for this task only</option></select></label>
      <label>Preference key<input value={key} onChange={(event) => setKey(event.target.value)} /></label>
      <label>Rationale for saving it<input value={rationale} onChange={(event) => setRationale(event.target.value)} /></label>
      <button type="submit">Submit for confirmation</button>
    </form>
    {message && <p className="notice">{message}</p>}
    <div className="feedback-columns">
      <div><h3>Awaiting confirmation</h3>{feedback.filter((item) => item.status === "pending_confirmation").map((item) => <article className="feedback-item" key={item.id}><p>{item.statement}</p><small>{item.context}</small><button type="button" onClick={() => void confirm(item)}>{item.persistence === "durable" ? "Confirm and save preference" : "Confirm for this task"}</button></article>)}{feedback.every((item) => item.status !== "pending_confirmation") && <p className="muted">Nothing waiting.</p>}</div>
      <div><h3>Active preferences</h3>{preferences.filter((item) => item.status === "active").map((item) => <article className="feedback-item" key={item.id}><strong>{item.key}</strong><p>{item.statement}</p><small>Applies to: {item.appliesTo}</small></article>)}{preferences.every((item) => item.status !== "active") && <p className="muted">No active preferences yet.</p>}</div>
    </div>
  </section>;
}
