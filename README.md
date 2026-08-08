# Agent Foundry control plane

Agent Foundry is a provider-neutral operating system for governed agent work.
This repository starts with the control-plane kernel: typed domain contracts,
capability and workforce governance, deny-by-default policy checks, spend
authorization, an idempotent tool gateway, cache/memory governance contracts,
and a minimal control panel shell.

The first implementation is intentionally mock-first. No live provider write,
payment, account creation, terms acceptance, or production credential is wired
into the application.

## Current foundation

- `packages/domain` — scoped identifiers, manifests, objectives, costs, memory,
  caches, audits, and workflow records.
- `packages/agents` — capability registry and governed hiring workflow.
- `packages/policies` — execution ladder, action classification, untrusted-content
  handling, authority checks, and immutable policy versions.
- `packages/finance` — short-lived spend authorization and double-entry subledger.
- `packages/tools` — registered-tool gateway with idempotency and production-write lock.
- `supabase/migrations` — initial Postgres/RLS schema.
- `docs/` — architecture, threat model, legal structure, and operating controls.

See [docs/setup.md](docs/setup.md) for local setup and the exact remaining human
account-connection steps.
