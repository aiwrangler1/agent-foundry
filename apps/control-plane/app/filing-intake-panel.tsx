"use client";

import { useEffect, useMemo, useState } from "react";

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

type FilingApproval = {
  state: string;
  owner: string;
  nextStep: string;
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
  approval: FilingApproval;
  updatedAt: string;
  mode: string;
  taxReview?: {
    status: string;
    cpaEscalationRequired: boolean;
    facts: string[];
    unresolvedQuestions: string[];
  };
};

type FilingResponse = {
  ok: boolean;
  demoMode: boolean;
  authenticated: boolean;
  readOnly: boolean;
  productionWritesEnabled: boolean;
  run: FilingRun;
  error?: string;
};

const starterQuestion = "What do we need to prepare before forming ARTJ LLC in New York, including publication, tax registration, and human review?";

export default function FilingIntakePanel() {
  const [question, setQuestion] = useState(starterQuestion);
  const [run, setRun] = useState<FilingRun | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [readOnly, setReadOnly] = useState(true);

  const intakeDisabled = useMemo(() => !demoMode || !authenticated || !readOnly || submitting, [authenticated, demoMode, readOnly, submitting]);

  async function refresh() {
    setLoading(true);
    const response = await fetch("/api/filing-intake");
    const data = await response.json() as FilingResponse;
    setDemoMode(data.demoMode === true);
    setAuthenticated(data.authenticated === true);
    setReadOnly(data.readOnly !== false);
    setRun(data.run);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const response = await fetch("/api/filing-intake", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question })
    });

    const data = await response.json() as FilingResponse;

    if (!data.ok) {
      setMessage(data.error ?? "Could not start the filing research preview.");
      setSubmitting(false);
      return;
    }

    setRun(data.run);
    setMessage("Read-only shadow run prepared. No filing was submitted, no payment was authorized, and no production write occurred.");
    setSubmitting(false);
  }

  return <section className="filing-panel">
    <div className="panel-heading">
      <div>
        <p className="muted">CEO filing research</p>
        <h2>Ask a filing question</h2>
      </div>
      <div className="pill-stack">
        <span className="status-pill warning">Read-only shadow mode</span>
        <span className={demoMode ? "status-pill warning" : "status-pill"}>{demoMode ? "Local demo auth" : "Human auth required"}</span>
      </div>
    </div>

    <p className="muted">This surface previews governed research and drafting only. It does not submit filings, pay fees, accept terms, or perform production writes.</p>

    <form onSubmit={submit} className="filing-form">
      <label>
        Filing question
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} required placeholder="Ask what to research, draft, or verify before a filing." />
      </label>
      <div className="banner-grid">
        <article className="mini-card">
          <strong>Execution ladder</strong>
          <p className="muted">Authoritative sources and deterministic checks come first. Human approval is required for decisions and any real-world action.</p>
        </article>
        <article className="mini-card">
          <strong>Authentication</strong>
          <p className="muted">{demoMode ? "Local demo actor is attached for preview runs." : "Preview is visible, but starting a run requires an authenticated human adapter."}</p>
        </article>
      </div>
      <button type="submit" disabled={intakeDisabled}>{submitting ? "Preparing read-only run…" : "Prepare read-only research run"}</button>
    </form>

    {message && <p className="notice">{message}</p>}
    {loading && <p className="muted">Loading filing research preview…</p>}

    {run && <div className="filing-results">
      <div className="card-row">
        <article className="mini-card"><p className="muted">Workflow state</p><h3>{run.workflowState}</h3><p className="muted">{run.statusDetail}</p></article>
        <article className="mini-card"><p className="muted">Task state</p><h3>{run.intakeState}</h3><p className="muted">{run.taskLabel}</p></article>
        <article className="mini-card"><p className="muted">Human approval</p><h3>{run.approval.state}</h3><p className="muted">{run.approval.nextStep}</p></article>
      </div>

      <article className="result-card">
        <div className="result-header">
          <div>
            <p className="muted">Current question</p>
            <h3>{run.question}</h3>
          </div>
          <small className="muted">Updated {run.updatedAt}</small>
        </div>
        <p className="muted">Mode: {run.mode}</p>
      </article>

      <div className="detail-grid">
        <article className="result-card">
          <h3>Status and evidence</h3>
          <ul className="result-list">
            {run.evidence.map((item) => <li key={`${item.label}-${item.source}`}><strong>{item.label}:</strong> {item.value}<span className="muted"> · {item.source}</span></li>)}
          </ul>
        </article>

        <article className="result-card">
          <h3>Draft checklist</h3>
          <ol className="result-list ordered">
            {run.draftChecklist.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </article>
      </div>

      <div className="detail-grid">
        <article className="result-card">
          <h3>Citations</h3>
          <ul className="citation-list">
            {run.citations.map((citation) => <li key={citation.id}>
              <a href={citation.url} target="_blank" rel="noreferrer">{citation.title}</a>
              <p>{citation.publisher}</p>
              <small className="muted">{citation.note}</small>
            </li>)}
          </ul>
        </article>

        <article className="result-card">
          <h3>Escalation reason</h3>
          <p>{run.escalationReason}</p>
          <div className="approval-box">
            <strong>{run.approval.owner}</strong>
            <p className="muted">{run.approval.nextStep}</p>
          </div>
        </article>
      </div>

      {run.taxReview && <article className="result-card">
        <h3>Tax reviewer</h3>
        <p><strong>{run.taxReview.status}</strong> — CPA confirmation is required before registration, filing, payment, remittance, or an entity-tax election.</p>
        <ul className="result-list">
          {run.taxReview.facts.map((fact) => <li key={fact}><strong>Fact:</strong> {fact}</li>)}
          {run.taxReview.unresolvedQuestions.map((question) => <li key={question}><strong>Unresolved:</strong> {question}</li>)}
        </ul>
      </article>}
    </div>}
  </section>;
}
