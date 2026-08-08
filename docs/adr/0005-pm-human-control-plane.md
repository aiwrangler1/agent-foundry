# ADR 0005: PM and human-control plane

## Status

Accepted for the first vertical slice; implementation proceeds incrementally.

## Context

Agent Foundry needs one human-facing operating surface for an autonomous
company. The surface must support management by exception: routine successful
work should be summarized, while approvals, human-only requests, blockers,
incidents, budget risk, and material business changes should interrupt the CEO.

The existing domain and schema already contain the canonical building blocks:
objectives, plans, tasks, workflow runs and steps, agents, teams, budgets,
spend reservations, approval requests, human requests, experiments, artifacts,
incidents, kill switches, and append-only audit events. Creating a separate PM
database would duplicate state and make the operating system drift from the
workflow system.

## Decision

The PM suite is a projection and command surface over canonical operational
records.

- Workflow and trusted server adapters remain the source of truth for task,
  workflow, cost, approval, and incident state.
- Human interactions are structured commands that validate role and policy,
  then emit append-only `PmEvent`/`AuditEvent` records and trigger or resume a
  workflow. Notes are classified into operational intent before they can create
  work; raw chat history is not an operational database.
- The UI is organized around CEO overview, portfolio, work board, workflows,
  agents and teams, finance, approvals, human requests, decisions,
  experiments, assets, integrations, governance, and incidents. Kanban,
  timeline, flow, dependency, workload, and drill-down views are first-class
  projections where the underlying records support them.
- The initial local adapter may use an in-memory projection for development and
  demo mode, but it must use the same typed contracts and event names as the
  durable adapter. Client writes remain deny-by-default outside explicit demo
  mode; production writes require a trusted server/workflow role and policy.
- Realtime delivery is an adapter concern. The first slice uses polling against
  the PM read model; a durable event stream or Supabase change feed can replace
  polling without changing the UI commands or domain event names.

## First vertical slice

The first implementation connects CEO overview, Kanban work, approval inbox,
human requests, task detail, notes, priority/status changes, and a structured
activity feed. It demonstrates the critical loop:

```text
workflow event or human command
  -> typed event / audit record
  -> PM projection refresh
  -> workflow resume, assignment, or escalation
```

The remaining areas are represented in the application shell and are expanded
against their existing domain records rather than as disconnected mock tables.

## Consequences

Positive:

- The CEO can act from one place without turning chat into the source of truth.
- Agent and workflow activity, human attention, and financial attribution can
  share identifiers and be drilled into together.
- Demo mode is useful for product development while preserving production
  boundaries.

Tradeoffs:

- A complete live suite depends on server-side authorization, durable event
  storage, realtime delivery, and adapters for provider telemetry.
- Some charts remain unavailable or explicitly marked as not connected until
  those providers are authorized and their records are mapped.
- The PM UI must evolve whenever new canonical operational entities or event
  types are added.

