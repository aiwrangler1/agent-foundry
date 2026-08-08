# ADR 0004: stacked OODA loops and Vercel v1 runtime

- Status: accepted for v1
- Date: 2026-08-06

## Context

Reliable growth requires recurring Observe, Orient, Decide, Act loops with a
review boundary. These loops should stack: company strategy contains a
business-unit loop, which contains an internal harness roadmap loop, which
contains objective and workflow loops.

The runtime also has distinct responsibilities. Codex and OpenCode are agent
harnesses. AI SDK HarnessAgent is the common abstraction connecting them. Vercel
Workflows is durable orchestration, Vercel Sandbox is isolated worker
execution, and Next.js/Vercel hosts the control panel. Vercel is not the
harness.

## Decision

Use Vercel for v1 durable workflows, sandboxed workers, and control-panel
hosting. Keep `WorkflowEngine`, `SandboxProvider`, `ModelRouter`, and
`CredentialProvider` behind provider-neutral interfaces so Temporal or
Cloudflare can be evaluated later.

Codex and OpenCode remain experimental harness adapters. Because native tool
filtering and built-in approval requests are not assumed, risky tools never
enter a harness. They remain behind the deterministic tool gateway, where
action classes, authority, spend authorization, idempotency, and approvals are
enforced.

The harness roadmap gets its own OODA loop and review cadence. A review must
consider reliability, cost, safety incidents, approval friction, and provider
capability changes before promoting a harness or changing boundaries.

## Migration trigger

Evaluate Temporal when a failed workflow could directly lose meaningful money
or customers, or when the required durability, replay, isolation, or operating
controls exceed the Vercel implementation. Keep Cloudflare Workflows/Agents as
an execution-cost comparison and Cloudflare OS as a governed employee-workspace
comparison, not as assumptions about the v1 architecture.
