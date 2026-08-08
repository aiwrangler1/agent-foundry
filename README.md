# ARTJ LLC control plane

This repository is the provider-neutral control plane for ARTJ LLC’s governed
agent work. “Agent Foundry” is a technical/repository name, not the legal
entity or a required public master brand. The planned legal container is ARTJ
LLC, a New York single-member LLC, subject to attorney and CPA review.
This repository starts with the control-plane kernel: typed domain contracts,
capability and workforce governance, deny-by-default policy checks, spend
authorization, an idempotent tool gateway, cache/memory governance contracts,
and a minimal control panel shell. It now also includes a governed human
feedback loop for turning explicitly confirmed guidance into scoped preferences.

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
- `packages/feedback` — explicit human confirmation, preference activation,
  conflict/supersession rules, review/expiration filtering, and audit events.
- `packages/workflows` — durable workflow and sandbox ports plus stacked OODA
  loop transitions and review boundaries.
- `packages/integrations` — provider-neutral HarnessAgent, ModelRouter, and
  CredentialProvider contracts.
- `supabase/migrations` — initial Postgres/RLS schema.
- `docs/` — architecture, threat model, legal identity, human feedback, and operating controls.

See [docs/setup.md](docs/setup.md) for local setup and the exact remaining human
account-connection steps.
