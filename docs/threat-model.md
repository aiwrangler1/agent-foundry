# Threat model

Primary threats are prompt injection through external content, confused deputy
behavior at tool boundaries, unauthorized spend, cross-business-unit leakage,
duplicate external writes, policy drift, and authority escalation by an agent.

Mitigations are typed manifests, immutable policy versions, explicit action
classes, minimum authority, spend reservations/authorizations, idempotency
keys, RLS, append-only audit events, kill switches, redaction, and negative
tests that attempt to make untrusted content reveal secrets or bypass policy.

Residual risks include provider-side compromise, incorrect human approval,
misconfigured deployment credentials, and legal/accounting obligations not
captured by the operational subledger. These require operational review and
independent legal, tax, security, and accounting controls.
