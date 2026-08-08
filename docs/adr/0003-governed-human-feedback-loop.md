# ADR 0003: governed human feedback loop

- Status: accepted
- Date: 2026-08-06

## Context

Early operators need to teach the control plane preferences, explanations,
and working conventions without turning raw conversation history into hidden
authority or permanent policy. A one-person founding team also needs a clear
way to distinguish a one-time correction from a durable preference.

## Decision

Store human feedback as a scoped, provenance-bearing record that starts in
`pending_confirmation`. Durable feedback must be explicitly confirmed, turned
into a versioned preference proposal, and explicitly activated. Active
preferences are filtered by organization, business unit, audience, review time,
and expiration before context compilation.

Replacing an active preference requires explicit supersession. Feedback that
would alter policy, authority, approvals, secrets, or spend is never activated
as a preference; it is routed to the policy governance path. State transitions
produce append-only feedback events.

## Consequences

This adds deliberate human friction, but makes the learning loop inspectable,
reversible, and safe to use while the company is small. The control panel can
provide guidance and confirmation without granting an agent new authority.
Production persistence requires an authenticated human adapter and a trusted
server/workflow role; local demo writes are explicitly opt-in.
