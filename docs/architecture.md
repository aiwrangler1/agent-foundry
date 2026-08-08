# Architecture

The control plane is organized as a pnpm monorepo for ARTJ LLC. The application layer owns
HTTP/UI composition; packages own domain contracts and invariants; integrations
are replaceable adapters.

Legal identity is separate from product and repository identity: ARTJ LLC is
the planned legal container, while “Agent Foundry” is a technical name only.
Public product and shop names may vary, with assumed-name review when ARTJ LLC
conducts business under a persistent name other than its legal name.

```text
CEO / human operator
        |
control panel + API
        |
Vercel/WorkflowEngine ---- human request / approval ports
        |
        |                         |
        |
HarnessAgent (Codex/OpenCode)     Supabase adapter / mock adapter
        |
SandboxProvider (Vercel v1)
```

Vercel is a v1 runtime choice, not the harness. Codex and OpenCode connect
through `HarnessAgent`; AI SDK supplies the common abstraction. The harness
receives only scoped context and read-only tools. Risky actions become gateway
proposals and are executed only by the deterministic tool gateway.

OODA loops are stacked: company, business unit, harness roadmap, objective,
workflow, and agent loops. Each loop has an explicit observe, orient, decide,
act sequence and a review boundary before its next cycle.

The execution ladder is explicit: cache, authoritative retrieval,
deterministic rule, script/database query, API/tool, deterministic workflow,
least-cost qualified model, stronger qualified model, human escalation.

The compiler and context modules are versioned records. Stable modules precede
dynamic task context in the compiled prompt. Raw conversation history is not a
memory store. Human feedback follows an explicit pending-confirmation,
preference-proposal, and activation lifecycle before it can enter compiled
context; it cannot grant authority or bypass policy.
